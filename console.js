/**
 * ConsoleJS
 *
 * @fileoverview A debug console abstraction
 *
 * @author: Brett Fattori (brettf@renderengine.com)
 *
 * Copyright (c) 2013 Brett Fattori (brettf@renderengine.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
(function () {

    var global = this, toString = Object.prototype.toString, ua = navigator.userAgent.toLowerCase(), idx,
        CONSOLEJS_VERSION = "1.0.0";

    /**
     * Add consoleJS debug levels to global object.  These are inclusive as the level gets more vebose.
     * Verbosity is the inverse of the array index (0 is the most verbose)
     */
    global.DEBUGLEVEL_VERBOSE = 0;
    global.DEBUGLEVEL_INFO = 1;
    global.DEBUGLEVEL_DEBUG = 2;
    global.DEBUGLEVEL_WARNINGS = 3;
    global.DEBUGLEVEL_ERRORS = 4;

    /**
     * Special case: Exclude all debug messages from console.
     */
    global.DEBUGLEVEL_NONE = -1;

    var verbosity = global.DEBUGLEVEL_NONE, enableDebugOutput = false, dumpWindow = null,
        isFireBug = (typeof firebug !== "undefined"), isMSIE = /(msie)/.test(ua), isWebkit = /(webkit)/.test(ua),
        isOpera = /(opera)/.test(ua), isNoConsole = !(isFireBug || isMSIE || isWebkit || isOpera),
        infoMethod = (isMSIE || isWebkit) ? 'log' : 'info', maxDepthOfInspection = 2, prettyPrint = false;

    /**
     * The Assertion error type
     */
    global.AssertionError = function(assertMessage) {
        this.message = assertMessage;
        this.name = "AssertionError";
    };
    global.AssertionError.prototype = new global.Error();

    /**
     * @class The base class for the console object. Each type of supported console outputs
     *        its data differently.  This class allows abstraction between the console and the
     *        browser's console object so the {@link Console} can report to it.
     */
    var cjs = function () {
    };

    /**
     * Verifies that the debug level is the same as the message to output
     * @private
     */
    function checkVerbosity(debugLevel) {
        if (!enableDebugOutput) return false;

        return (verbosity === global.DEBUGLEVEL_VERBOSE ||
            (debugLevel !== global.DEBUGLEVEL_VERBOSE && debugLevel >= verbosity));
    }

    function combiner() {
        var combinedArgs = "";
        for (var argIndex = 0; argIndex < arguments.length; argIndex++)
            combinedArgs += arguments[argIndex].toString();
        return combinedArgs;
    }

    function inspectObject(source, depth) {
        var str, element;

        depth = depth || 0;

        if (depth > maxDepthOfInspection) {
            return "...";
        }

        if (typeof source === "undefined")
            return "undefined";
        else if (source === null)
            return "null";
        else if (toString.call(source) === "[object Function]")
            return "function";
        else if (toString.call(source) === "[object Array]") {
            str = "[";
            for (element = 0; element < source.length; element++)
                str += (str.length > 1 ? "," : "") + inspectObject(source[element], depth++);
            return str + "]";
        } else if (toString.call(source) === "[object Object]") {
            str = "{\n";
            for (element in source)
                if (source.hasOwnProperty(element))
                    str += element + ": " + inspectObject(source[element], depth++) + "\n";
            return str + "}\n";
        } else {
            return source.toString();
        }
    }

    function fixArgs(args) {
        var fixedArgs = [];
        for (var i = 0; i < args.length; i++)
            if (args[i])
                fixedArgs.push(inspectObject(args[i]));
        return fixedArgs.join(" ");
    }

    function checkConsoleMethod(method) {
        return isOpera ? opera.postError : (method === 'info' ? infoMethod : method);
    }

    function doLog(method, args) {
        var target = (isFireBug ? firebug.d.console : console),
            targetMethod = target[checkConsoleMethod(method)],
            argsList = [];

        for (idx = 0; idx < args.length; idx++) {
            argsList.push(args[idx]);
        }

        if (isMSIE) {
            targetMethod(fixArgs(argsList));
        } else if (isOpera) {
            argsList.unshift("[" + method + "] ");
            targetMethod(fixArgs(argsList));
        } else {
            argsList = prettyPrint ? fixArgs(argsList) : argsList;
            targetMethod.apply(target, argsList)
        }

    }

    // Public Methods
    cjs.prototype = {
        /**
         * Set the debug output level of the console.  The available levels are:
         * <ul>
         * <li><tt>DEBUGLEVEL_ERRORS</tt></li>
         * <li><tt>DEBUGLEVEL_WARNINGS</tt></li>
         * <li><tt>DEBUGLEVEL_DEBUG</tt></li>
         * <li><tt>DEBUGLEVEL_INFO</tt></li>
         * <li><tt>DEBUGLEVEL_VERBOSE</tt></li>
         * <li><tt>DEBUGLEVEL_NONE</tt></li>
         * </ul>
         * Messages of the same (or lower) level as the specified level will be logged.
         * For instance, if you set the level to <tt>DEBUGLEVEL_DEBUG</tt>, errors and warnings
         * will also be logged.  The engine must also be in debug mode for warnings,
         * debug, and log messages to be output.
         *
         * @param level {Number} One of the debug levels.  Defaults to DEBUGLEVEL_NONE.
         * @return {Number} The current debug level
         */
        debugLevel:function (level) {
            if (typeof level !== "undefined") {
                verbosity = level;

                // Automatically enable output, unless no debugging is specified
                enableDebugOutput = level != global.DEBUGLEVEL_NONE;
            }
            return verbosity;
        },

        /**
         * Set the depth of inspections which recursively step into nested objects.
         * @param depth {Number} The maximum depth of inspection
         * @return {Number} The currently set depth
         */
        inspectionDepth: function(depth) {
            if (typeof depth !== "undefined")
                maxDepthOfInspection = !isNaN(depth) ? depth : 2;
            return maxDepthOfInspection;
        },

        pretty: function(state) {
            if (typeof state !== "undefined")
                prettyPrint = state;
            return prettyPrint;
        },
        
        /**
         * Write a log message to the console
         */
        log:function () {
            if (checkVerbosity(global.DEBUGLEVEL_VERBOSE))
                doLog('info', arguments);
        },

        /**
         * Write an info message to the console
         */
        info:function () {
            if (checkVerbosity(global.DEBUGLEVEL_INFO))
                doLog('info', arguments);
        },

        /**
         * Write a debug message to the console
         */
        debug:function () {
            if (checkVerbosity(global.DEBUGLEVEL_DEBUG))
                doLog('debug', arguments);
        },

        /**
         * Write a warning message to the console
         */
        warn:function () {
            if (checkVerbosity(global.DEBUGLEVEL_WARNINGS))
                doLog('warn', arguments);
        },

        /**
         * Write an error message to the console
         */
        error:function () {
            if (checkVerbosity(global.DEBUGLEVEL_ERRORS))
                doLog('error', arguments);
        },

        /**
         * Write a stack trace to the console
         */
        trace:function () {
        },

        /**
         * Assert that a condition is <tt>true</tt>, throwing an exception if it is <tt>false</tt>.
         * If the assertion condition would result in an exception, a warning will be emitted to the
         * console.
         *
         * @param test {Boolean} A simple test that should evaluate to <tt>true</tt>
         * @param error {String} The error message to throw if the test fails
         */
        assert:function (test, error) {
            var fail = false;
            try {
                if (!test) {
                    fail = true;
                }
            } catch (ex) {
                var pr = this.debugLevel();
                this.debugLevel(global.DEBUGLEVEL_WARNINGS);
                this.warn("*ASSERT* 'test' would result in an exception: ", ex);
                this.debugLevel(pr);
            }

            // This will provide a stacktrace for browsers that support it
            if (fail)
                throw new global.AssertionError(error);
        },

        version: function() {
            this.log("ConsoleJS v" + CONSOLEJS_VERSION);
        }
    };

    // Export singleton
    global.ConsoleJS = new cjs();

})();
