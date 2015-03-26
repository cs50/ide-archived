define(function(require, exports, module) {
"use strict";

/**
* Data structure for quick fixes. Only for use within language handlers.
* 
* See {@link language.base_handler#getResolutions}.
* 
* @param {String} label short description, to be displayed in the list of resolutions
* @param {String} image image to be displayed in the list of resolutions
* @param {String} preview
* @param {Object[]} deltas the changes to be applied
* @param {Object} cursorTarget the position where the cursor should be after applying
* 
* @class language.MarkerResolution
*/
var MarkerResolution = function(label, image, preview, deltas, cursorTarget) {
    return {
        label: label,
        image: image,
        preview: preview,
        deltas: deltas,
        cursorTarget: cursorTarget
    };
}; 

exports.MarkerResolution = MarkerResolution;

});