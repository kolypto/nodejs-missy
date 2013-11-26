'use strict';

/** Make up a function shouldNever to be used for promise termination in branches that should never be executed.
 * @param test
 * @returns {Function}
 */
var shouldNeverFunc = exports.shouldNeverFunc = function(test){
    return function(title){
        return function(e){
            test.ok(false, 'Should never get here: ' + title, arguments);
            if (e && e instanceof Error)
                console.error(e.stack);
        };
    };
};
