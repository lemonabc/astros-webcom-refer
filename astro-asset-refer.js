'use strict';

var util = require('lang-utils');

var reg_def = /<def:([a-z,A-Z,0-9,\-,\_]+)[\s]*?>([\s\S]*?)<\/def>/ig;
var reg_point = /<point:([a-z,A-Z,0-9,\-,\_]+)[\s]*?\/?>/ig;
var reg_module = /<(module\:([a-z,A-Z,0-9,\-,\_,\/]+))([^\/]*?)(?:(?:>([\s\S]*)<\/module>)|(?:\/>))/gi;

/**
 * 分析页面引用的模块，并将依赖的模块列表挂载在
 * 在asset的comments属性上
 */

module.exports = new astro.Middleware({
    modType: ['page'],
    fileType: ['css','js']
}, function(asset, next) {
    let prjCfg = asset.prjCfg;

    let code = new astro.Asset({
        ancestor: asset,
        project: asset.project,
        modType: 'page',
        name: asset.name,
        fileType: 'html'
    }).read();

    let _count = 0;
    let componentsList = [];

    while (reg_module.test(code)) {
        if (++_count == 1000) {
            console.error('astro.compiler    astro.engine-->出现模块相互引用\n' + code)
            return ''; //'<div class="mo-error">Module循环引用超过100次</div>';
        }
        code = code.replace(reg_module, function(fullCode, modstr, modName, attrs, modcontent) {
            /*
                <moduel:layout title="title">hello</module:layout>
                ------
                modcode = <moduel:layout title="title">hello</module:layout>
                modstr  = moduel:layout
                modname = layout
                attrs   = title="title"
                modcontent = hello    // <module:header />   ==>> modcontent is undefined
             */
            let retStr = '';

            let modCode = new astro.Asset({
                request: asset.request,
                project: asset.project,
                modType: 'webCom',
                name: modName,
                fileType:'html'
            }).read();
            if (modCode) {
                componentsList.push(modName);
                //不是闭合标签，中间有内容
                let defined = modcontent ? getDefined(modcontent) : {};
                let hasPoint;
                retStr += modCode.replace(reg_point, function(str, name) {
                    if (defined[name]) {
                        return defined[name];
                    } else {
                        // 没有实现插入点时，则替换把内容替换到第一个 point中
                        if (util.isEmptyObject(defined) && !hasPoint) {
                            hasPoint = true;
                            return modcontent;
                        }
                    }
                    hasPoint = true;
                    return '';
                });
                return retStr;
            } else {
                return ''; //'<div class="mo-error">未找到模块:' + modname + '</div>';
            }
        });
    asset.components = util.dequeueArray(componentsList);
    }

    next(asset);
});

function getDefined(code) {
    var defined = {};
    code.replace(reg_def, function(code, name, ctx) {
        defined[name] = ctx;
        return code;
    });
    return defined
}