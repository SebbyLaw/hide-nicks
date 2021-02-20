const { Plugin } = require('powercord/entities');
const { getModule, getModuleByDisplayName, i18n: { Messages }, React } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const { getOwnerInstance, findInReactTree } = require('powercord/util');

const NicknameWrapper = require('./NicknameWrapper');

module.exports = class HideNicks extends Plugin {
    async startPlugin () {
        const messageHeader = await getModule(["MessageTimestamp"]);
        const memberListItem = await getModuleByDisplayName("MemberListItem");
        const voiceUser = await getModuleByDisplayName("VoiceUser");
        const reply = await getModule(m => m.default?.displayName === "RepliedMessage");
        const guildUserContextMenu = await getModule(m => m.default?.displayName === "GuildChannelUserContextMenu");

        inject(
            "hide-nicks-messageHeaderPatch",
            messageHeader,
            "default",
            this.messageHeaderPatch
        );
        inject(
            "hide-nicks-memberListItemPatch",
            memberListItem.prototype,
            "render",
            this.memberListItemPatch
        );
        inject(
            "hide-nicks-voiceUserPatch",
            voiceUser.prototype,
            "renderName",
            this.voiceUserPatch
        );
        inject(
            "hide-nicks-replyPatch",
            reply,
            "default",
            this.replyPatch
        );
        inject(
            "hide-nicks-guildUserContextPatch",
            guildUserContextMenu,
            "default",
            this.contextPatch
        );

        reply.default.displayName = "RepliedMessage";
        guildUserContextMenu.default.displayName = "GuildChannelUserContextMenu";
    }

    pluginWillUnload() {
        uninject("hide-nicks-messageHeaderPatch");
        uninject("hide-nicks-memberListItemPatch");
        uninject("hide-nicks-voiceUserPatch");
        uninject("hide-nicks-replyPatch");
        uninject("hide-nicks-guildUserContextPatch");
    }

    messageHeaderPatch(args, res) {
        const message = args[0].message;
        const display_name = message.author.username;

        const username = findInReactTree(res, e => e.props && e.props.message);

        if (!username) return res;
        if (username.__originalType) return res;

        username.props.__originalType = username.type;
        username.type = function (props) {
            const { __originalType: originalType, ...passedProps } = props;
            const result = originalType.apply(this, [passedProps]);
            const basePopoutElement = findInReactTree(
                result,
                e =>
                    e.props &&
                    e.props.renderPopout &&
                    typeof e.props.children === "function"
            );

            if (basePopoutElement) {
                const original = basePopoutElement.props.children(
                    result.props.children[1].props
                );
                original.props.children = React.createElement(NicknameWrapper, {
                    style: result.props.style,
                    display_name: display_name,
                });
                basePopoutElement.props.children = () => original;
            }
            return result;
        };
        
        return res;
    }

    memberListItemPatch(_, res) {
        if (!this.props.user) return res;
        const display_name = this.props.user.username;

        res.props.name.props.children = React.createElement(NicknameWrapper, {
            style: res.props.name.props.style || {},
            display_name: display_name,
        });

        return res;
    }

    voiceUserPatch(_, res) {
        if (!res) return res;
        const display_name = this.props.user.username;

        res.props.children = React.createElement(NicknameWrapper, {
            style: {},
            display_name: display_name,
        });

        return res;
    }

    discordTagPatch(args, res) {
        const display_name = args[0].user.username;

        const originalType = res.type;

        res.type = function (props) {
            const res = originalType(props);
            res.props.children[0].props.children = React.createElement(NicknameWrapper, {
                style: {},
                display_name: display_name,
            });

            return res;
        };

        return res;
    }

    replyPatch(args, res) {
        // const display_name = args[0].referencedMessage.message.author.username;

        const username = findInReactTree(
            res,
            e =>
                e.props?.renderPopout &&
                e.props?.message?.id === args[0].referencedMessage.message.id
        );

        if (!username) return res;
        if (username.__originalType) return res;

        username.props.__originalType = username.type;
        username.type = function (props) {
            const { __originalType: originalType, ...passedProps } = props;
            const result = originalType.apply(this, [passedProps]);
            const basePopoutElement = findInReactTree( // not actually BasePopoutElement, :woozy
                result,
                e => true
                    // e.props &&
                    // e.props.renderPopout &&
                    // typeof e.props.children === "function"
            );

            basePopoutElement.props.author.nick = basePopoutElement.props.message.author.username;

            // if (basePopoutElement) {
            //     const original = basePopoutElement.props.children(
            //         result.props.children[1].props
            //     );

            //     original.props.children = React.createElement(NicknameWrapper, {
            //         style: result.props.style,
            //         display_name: display_name,
            //     });
            //     basePopoutElement.props.children = () => original;
            // }
            return result;
        };

        return res;
    }

    contextPatch(args, res) {
        const display_name = args[0].user.username;

        const [kick, ban] = res.props.children.props.children[4].props.children;

        if (kick) kick.props.label = `${Messages.KICK} ${display_name}`;
        if (ban) ban.props.label = `${Messages.BAN} ${display_name}`;

        return res;
    }
}
