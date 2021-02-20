const { React } = require("powercord/webpack");

module.exports = function(props) {
    return (<span style={props.style}>{props.display_name}</span>);
};
