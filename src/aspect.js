/**
 * Aspect Oriented framework inspired by the Danne Lundqvist's article
 *
 * http://www.dotvoid.com/2005/06/aspect-oriented-programming-and-javascript/
 */
(function(host) {

  /**
   * The implementation to intercept constructor or objects with join points.
   * @class jsAspect
   * http://smthngsmwhr.wordpress.com/2013/06/23/aspect-oriented-programming-in-javascript/
   */
  var jsAspect = {
    pointcuts: {},
      advices: {}
    },
    adviceEnhancedFlagName = "__jsAspect_advice_enhanced",

    /**
     * All supported join points to join additional behavior.
     * @enum {string}
     * @readonly
     */
    allAdvices = ["before", "after", "afterThrowing", "afterReturning", "around"],

    /**
     * All supported pointcuts.
     * @enum {string}
     * @readonly
     */
    allPointcuts = ["methods", "prototypeMethods", "method"];

  allAdvices.forEach(function (advice) {
    jsAspect.advices[advice] = "__" + advice;
  });
  allPointcuts.forEach(function (pointcut) {
    jsAspect.pointcuts[pointcut] = pointcut;
  });

  /**
   * Extends/Introduces additional properties like fields or function to a passed constructor or object.
   * @param {Function|Object} target The object or constructor that want to be extended
   * @param {allPointcuts} pointcut Specifies if the properties are introduced to the function's prototype or the function directly (static fields).
   * @param {Object} introduction The properties that want to be extended.
   * @returns {Object} The target with extended properties.
   */
  jsAspect.extend = function (target, pointcut, introduction) {
    target = (jsAspect.pointcuts.prototypeMethods == pointcut) ? target.prototype : target;

    for (var property in introduction) {
      if (introduction.hasOwnProperty(property)) {
        target[property] = introduction[property];
      }
    }

    return target;
  };

  /**
   * Creates join points at the passed pointcut and advice name.
   * @param {Object|Function} target The target or namespace, which methods want to be intercepted.
   * @param {allPointcuts} pointcut The pointcut to specify or quantify the join points.
   * @param {allAdvices} adviceName The chosen join point to add the advice code.
   * @param {Function} advice The code, that needs to be executed at the join point.
   * @param {String} [methodName] The name of the method that need to be advised.
   * @method inject
   * @returns void
   */
  jsAspect.inject = function (target, pointcut, adviceName, advice, methodName) {
    if (jsAspect.pointcuts.method == pointcut) {
      injectAdvice(target, methodName, advice, adviceName);
    } else {
      target = (jsAspect.pointcuts.prototypeMethods == pointcut) ? target.prototype : target;
      for (var method in target) {
        if (target.hasOwnProperty(method)) {
          injectAdvice(target, method, advice, adviceName);
        }
      }
    }
  };

  /**
   * Intercepts a single method with a join point and adds an advice.
   * @param target
   * @param methodName
   * @param advice
   * @param adviceName
   * @private
   * @method injectAdvice
   */
  function injectAdvice(target, methodName, advice, adviceName) {
    if (isFunction(target[methodName])) {
      if (jsAspect.advices.around == adviceName) {
        advice = wrapAroundAdvice(advice);
      }
      if (!target[methodName][adviceEnhancedFlagName]) {
        enhanceWithAdvices(target, methodName);
        target[methodName][adviceEnhancedFlagName] = true;
      }
      target[methodName][adviceName].unshift(advice);
    }
  }

  /**
   * Wraps an existing advice, to add a additional advice at the same join point.
   * @param advice
   * @returns {wrappedAdvice}
   * @private
   */
  function wrapAroundAdvice(advice) {

    var wrappedAdvice = function(leftAroundAdvices) {
      var oThis = this,
        nextWrappedAdvice = leftAroundAdvices.shift(),
        args = [].slice.call(arguments, 1);

      if (nextWrappedAdvice) {
        var nextUnwrappedAdvice = function() {
          var argsForWrapped = [].slice.call(arguments, 0);

          argsForWrapped.unshift(leftAroundAdvices);
          return nextWrappedAdvice.apply(oThis, argsForWrapped);
        };
        args.unshift(nextUnwrappedAdvice);
      }
      return advice.apply(this, args);
    };

    //Can be useful for debugging
    wrappedAdvice.__originalAdvice = advice;
    return wrappedAdvice;
  }

  /**
   * Intercepts the target's method with all supported join points
   * @param target
   * @param methodName
   */
  function enhanceWithAdvices(target, methodName) {
    var originalMethod = target[methodName];

    target[methodName] = function() {
      var self = this,
        method = target[methodName],
        args = [].slice.call(arguments, 0),
        returnValue = undefined,
        executionContext = new ExecutionContext(target, methodName);

      applyBeforeAdvices(self, method, args, executionContext);
      if (executionContext.isStopped) return;
      try {
        returnValue = applyAroundAdvices(self, method, args);
      } catch (exception) {
        applyAfterThrowingAdvices(self, method, exception);
        throw exception;
      }
      applyAfterAdvices(self, method, args);
      return applyAfterReturningAdvices(self, method, returnValue);
    };
    allAdvices.forEach(function (advice) {
      target[methodName][jsAspect.advices[advice]] = [];
    });
    target[methodName][jsAspect.advices.around].unshift(wrapAroundAdvice(originalMethod));
  }

  /**
   * Adds the before-join point to add behaviour <i>before</i> the method is executed.
   * @param context
   * @param method
   * @param args
   * @param executionContext
   */
  function applyBeforeAdvices(context, method, args, executionContext) {
    var beforeAdvices = method[jsAspect.advices.before];

    beforeAdvices.forEach(function (advice) {
      var adviceArguments = args.slice();

      adviceArguments.unshift(executionContext);

      if (!executionContext.isStopped) {
        advice.apply(context, adviceArguments);
      }
    });
  }

  /**
   * Adds the join point to control the method execution manually (executed before the <i>before</i> join point).
   * @param context
   * @param method
   * @param args
   * @returns {Function|Object}
   */
  function applyAroundAdvices(context, method, args) {
    var aroundAdvices = method[jsAspect.advices.around]
        .slice(0, method[jsAspect.advices.around].length),
      firstAroundAdvice = aroundAdvices.shift(),
      argsForAroundAdvicesChain = args.slice();

    argsForAroundAdvicesChain.unshift(aroundAdvices);
    return firstAroundAdvice.apply(context, argsForAroundAdvicesChain);
  }

  /**
   * Adds the join point to add behaviour <i>after</i> the method thrown an exception.
   * @param context
   * @param method
   * @param exception
   */
  function applyAfterThrowingAdvices(context, method, exception) {
    var afterThrowingAdvices = method[jsAspect.advices.afterThrowing];

    afterThrowingAdvices.forEach(function (advice) {
      advice.call(context, exception);
    });
  }

  /**
   * Adds the before-join point to add behaviour <i>before</i> the method is executed.
   * @param context
   * @param method
   * @param args
   */
  function applyAfterAdvices(context, method, args) {
    var afterAdvices = method[jsAspect.advices.after];

    afterAdvices.forEach(function (advice) {
      advice.apply(context, args);
    });
  }

  /**
   * Adds the join point to add behaviour <i>after</i> the method returned a value or the method stopped working (no return value).
   * @param context
   * @param method
   * @param returnValue
   * @returns {Object}
   */
  function applyAfterReturningAdvices(context, method, returnValue) {
    var afterReturningAdvices = method[jsAspect.advices.afterReturning];

    return afterReturningAdvices.reduce(function (acc, current) {
      return current(acc);
    }, returnValue);
  }

  /**
   * Type of the parameter, that is passed to the advices. It contains information about the method and constructor itself.
   * @param target
   * @param methodName
   * @constructor
   */
  function ExecutionContext(target, methodName) {
    this.target = target;
    this.methodName = methodName;
    this.targetConstructor = target.constructor;
    this.isStopped = false;
  }

  ExecutionContext.prototype.stop = function() {
    this.isStopped = true;
  };

  function isFunction(obj) {
    return obj && Object.prototype.toString.call(obj) == '[object Function]';
  }

  host.jsAspect = jsAspect;
})(window);