var angular = require('angular');
var map = angular.__NG_HOT_MAP = Object.create(null);
var slice = Array.prototype.slice;
var isArray = Array.isArray;
var hasOwnProperty = Object.hasOwnProperty;
var getOwnPropertyNames = Object.getOwnPropertyNames;
var keys = Object.keys;
var kebabCase  = require('./utils').kebabCase;

exports.init = function () {
    
    var v = angular.version;
    exports.compatible = (v.major == 1 && v.minor >= 5);

    // https://docs.angularjs.org/guide/migration#migrating-from-1-4-to-1-5
    if (!exports.compatible) {
        console.warn(
          '[HMR] You are using a version of ng-hot-reload-api that is ' +
          'only compatible with AngularJs core ^1.5.0.'
        )
        return;
    }

    var __ng__ = angular.module;
    function __module__(){

        var hijacked = __ng__.apply(this, arguments);
        
        if (hijacked.components) return hijacked;

        hijacked.component = (function (h) {
            var component = h.component;

            return function () {
                var args = arguments;

                // We map all the components that are 
                // registered by angular
                if (args[1].__id && map[args[1].__id]) {
                    map[args[1].__id].name = args[0];
                } else {
                    map[args[1].__id] = { name: args[0] };
                }

                if(args[1].components) {
                     h.components(args[1].components);
                }

                // Register the component
                return component.apply(h, args);
            }
        })(hijacked);
        
        function __queued__(name, module){
            var exist = false;
            hijacked._invokeQueue.forEach(function(proccess){
                if (proccess[1] === 'component' && proccess[2][0] === name) {
                    exist = true; return;
                };
            })
            return exist;
        }

        function __components__ (components) {

            if(angular.isObject(components)){
                Object.keys(components).forEach(function (name) {
                    var options = components[name];

                    if (options.components) __components__(options.components);

                    if (!__queued__(name, hijacked.name)) {
                        hijacked.component(name, options);
                    };
                })
            }

            return hijacked;
        }

        hijacked.components = __components__;
        return hijacked;
    }

    angular.module = __module__;
}

exports.register = function(id, component)
{
    map[id] = {
        component: component
    }
}

exports.update = function(id, component)
{
    var target = angular.__NG_HOT_MAP[id];
    var app = angular.element(document);
    var $injector = app.injector();

    if ($injector && target) {
        var $name = target.name || target.component.name;
        var $component  = $injector.get(`${$name}Directive`)[0];
        var $compile    = $injector.get('$compile');
        var $controller = $injector.get('$controller');
        
        if ($component) {
            $component.template = component.template || '';

            var originCtrlPrototype = getControllerPrototype($component.controller);
            var targetCtrlPrototype = getControllerPrototype(component.controller);

            var allProps = getOwnPropertyNames(targetCtrlPrototype);
            var selProps = keys(targetCtrlPrototype);

            var finallyProps = allProps.filter(function (key) {
                return selProps.indexOf(key) === -1 && key !== 'constructor';
            });

            selProps.forEach(function (prop) {
                originCtrlPrototype[prop] = targetCtrlPrototype[prop];
            });
        
            slice.call(app.find(kebabCase($name))).forEach(function(element){
                var $element = angular.element(element);
                $element.html($component.template);
                $compile($element.contents())($element.isolateScope());
            });

            app.find('html').scope().$apply();
            console.info(`[NGC] Hot reload ${$name} from ng-component-load`)
        }
    }
}

function getControllerPrototype(controller){
    return (isArray(controller) ? controller[controller.length - 1] : controller).prototype;
}
