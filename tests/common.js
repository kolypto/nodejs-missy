'use strict';

var _ = require('lodash')
    ;

/** Make up a function shouldNever to be used for promise termination in branches that should never be executed.
 * @param test
 * @returns {Function}
 */
var shouldNeverFunc = exports.shouldNeverFunc = function(test){
    return function(title){
        return function(e){
            test.ok(false, 'Should never get here: ' + title, _.map(arguments, function(arg){
                return (arg instanceof Error)? arg.stack : arg;
            }));
        };
    };
};
