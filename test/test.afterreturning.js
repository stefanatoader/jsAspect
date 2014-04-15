module("jsAspect.afterReturning");

(function() {
    
    test("jsAspect.inject: 'afterReturning' advice, 'prototypeMethods' pointcut", function() {
        function Object() {
        }
        Object.prototype.wrapValue = function(value) {
            return {value: value};
        };
        
        jsAspect.inject(Object, jsAspect.POINTCUT.PROTOTYPE_METHODS, jsAspect.JOIN_POINT.AFTER_RETURNING,
            function afterReturningCallback(context, retValue) {
                retValue.value = retValue.value + 1;
                return retValue;
            }
        );

        var obj = new Object();
        
        equal(obj.wrapValue(2).value, 3, "'afterReturning' advice is applied");     
    });

    test("jsAspect.inject: several 'afterReturning' aspects", function() {
        function Object() {
        }

        Object.prototype.identity = function(value) {
            return value;
        };
        
        ["aspect1", "aspect2", "aspect3"].forEach(function (aspectName) {
            jsAspect.inject(Object, jsAspect.POINTCUT.PROTOTYPE_METHODS, jsAspect.JOIN_POINT.AFTER_RETURNING,
                function afterReturningCallback(context, retValue) {
                    return retValue + "_" + aspectName;
                }
            );
        });
        
        equal(new Object().identity("value"), "value_aspect3_aspect2_aspect1", "'afterReturning' several aspects applied in the reverse order");
    });
    test("jsAspect.inject: 'afterReturning' has context", function ()
    {
      function Object()
      {
      }

      Object.prototype.identity = function (value)
      {
        return value;
      };

        jsAspect.inject(Object, jsAspect.POINTCUT.PROTOTYPE_METHODS, jsAspect.JOIN_POINT.AFTER_RETURNING,
          function afterReturningCallback(context, retValue)
          {
            equal(context.method.name, "identity", "method name is passed to 'context' properly");
            deepEqual(context.method.arguments, ["test"], "method arguments are passed to 'context' properly");
            deepEqual(retValue, "test", "return value still passed.");
          }
        );

      var obj1 = new Object();
      obj1.identity("test");

    });
})();