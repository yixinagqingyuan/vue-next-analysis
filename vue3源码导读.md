**工程化**

**learn(monorepo)**

*Monorepo*的意思是在版本控制系统的单个代码库里包含了许多项目的代码。这些项目虽然有可能是相关的，但通常在逻辑上是独立的，并由不同的团队维护。

​    ![0](https://note.youdao.com/yws/res/2624/CE30804F8E45461182E88488EC20A98B)

**roullp**

Rollup 是一个 JavaScript 模块打包器，可以将小块代码编译成大块复杂的代码，也是目前库的打包首选bundler

**ts**

这个不用多说，目前社区呼声很高

**cicd**

release.js  尤大自己写的，可以自行去目录里面去看

**依赖包管理**

pnpm - 速度快、节省磁盘空间的软件包管理器 

**单元测试**

Jest 是一个令人愉快的 JavaScript 测试框架，专注于 简洁明快

**代码校验**

ESLint可组装的JavaScript和JSX检查工具

**目录结构**

learn 构建工程，所有的目录散在packages中，并且packages中的包也能单独使用，比较重要的包 compiler-core（编译器的核心逻辑） compiler-dom（dom 平台的编译器）vue-compiler-sfc(解析SFC组件类似vue2中的vue-lorder) reactivity（响应式）  runtime-core（运行时代码，包含渲染器，vnode ，调度器 ）runtime-dom （dom 平台相关） shared（初始化的一些变量啊，工具函数等等）vue（最后打出不同包的目录）



## 响应式系统

![vue 3 响应式系统原理](https://segmentfault.com/img/remote/1460000020629162)

```
  // 保存临时依赖函数用于包装
        const effectStack = [];

        // 依赖关系的map对象只能接受对象
        let targetMap = new WeakMap();
        // 判断是不是对象
        const isObject = (val) => val !== null && typeof val === 'object';
        // ref的函数
        function ref(val) {
            // 此处源码中为了保持一致，在对象情况下也做了用value 访问的情况value->proxy对象
            // 我们在对象情况下就不在使用value 访问
            return isObject(val) ? reactive(val) : new refObj(val);
        }

        //创建响应式对象
        class refObj {
            constructor(val) {
                this._value = val;
            }
            get value() {
                // 在第一次执行之后触发get来收集依赖
                track(this, 'value');
                return this._value;
            }
            set value(newVal) {
                console.log(newVal);
                this._value = newVal;
                trigger(this, 'value');
            }
        };

        // 对象的响应式处理 在这里我们为了理解原理原理暂时不考虑对象里嵌套对象的情况
        // 其实对象的响应式处理也就是重复执行reactive 
        function reactive(target) {
            return new Proxy(target, {
                get(target, key, receiver) {
                    // Reflect用于执行对象默认操作，更规范、函数式
                    // Proxy和Object的方法Reflect都有对应
                    const res = Reflect.get(target, key, receiver);
                    track(target, key);
                    return res;
                },
                set(target, key, value, receiver) {
                    const res = Reflect.set(target, key, value, receiver);
                    trigger(target, key);
                    return res;
                },
                deleteProperty(target, key) {
                    const res = Reflect.deleteProperty(target, key);
                    trigger(target, key);
                    return res;
                }
            });
        }

        // 到此处，当前的ref 对象就已经实现了对数据改变的监听
        const newRef = ref(0);
        // 但是还是没有响应式的能力，那么他是怎样实现响应式的呢----依赖收集，触发更新=
        // 用来做依赖收集 
        // 在源码中为为了方法的通用性，他还传入了很多参数用于兼容不同情况
        // 我们意在理解原理，只需要包装fn 即可
        function effect(fn) {
            // 包装当前依赖函数
            const effect = function reactiveEffect() {
                // 模拟源码中也加入错误处理，为了避免你瞎写出现错误的情况，这就是框架的高明之处
                if (!effectStack.includes(effect)) {
                    try {
                        // 给当前函数放入临时栈中，为在下面执行中，触发get，在依赖收集中能找到当前变量的依赖项来建立关系
                        effectStack.push(fn);
                        // 执行当前函数，开始依赖收集了
                        return fn();
                    } finally {
                        // 执行成功了出栈
                        effectStack.pop();
                    }
                };
            };

            effect();
        }
        //  在收集的依赖中建立关系
        function track(target, key) {
            // 取出最后一个数据内容
            const effect = effectStack[effectStack.length - 1];
            // 如果当前变量有依赖
            if (effect) {
                //判断当前的map中是否有target
                let depsMap = targetMap.get(target);
                // 如果没有
                if (!depsMap) {
                    // new map存储当前weakmap
                    depsMap = new Map();
                    targetMap.set(target, depsMap);
                }
                // 获取key对应的响应函数集
                let deps = depsMap.get(key);
                if (!deps) {
                    // 建立当前key 和依赖的关系，因为一个key 会有多个依赖
                    // 为了防止重复依赖，使用set
                    deps = new Set();
                    depsMap.set(key, deps);
                }
                // 存入当前依赖
                if (!deps.has(effect)) {
                    deps.add(effect);
                }
            }
        }
        // 用于触发更新
        function trigger(target, key) {
            // 获取所有依赖内容
            const depsMap = targetMap.get(target);
            // 如果有依赖的话全部拉出来执行
            if (depsMap) {
                // 获取响应函数集合
                const deps = depsMap.get(key);
                if (deps) {
                    // 执行所有响应函数 
                    const run = (effect) => {
                        // 源码中有异步调度任务，我们在这里省略
                        effect();
                    };
                    deps.forEach(run);
                }
            }
        }
        effect(() => {
            console.log(11111);
            // 在自己实现的effect中，由于为了演示原理，没有做兼容，不能来触发set,否则会死循环
            // vue源码中触发对effect中的做了兼容处理只会执行一次
            newRef.value;
        });

        newRef.value++;

```



 ## 组件化

### 组件的本质

在 `JQuery` 年代，模板引擎的概念，干的年头长的都应该听过

```js
import { template } from 'lodash'

const compiler = template('<h1><%= title %></h1>')
const html = compiler({ title: 'My Component' })

document.getElementById('app').innerHTML = html
```

模板引擎的概念就是 就是通过数据加上模板最后生成html

而在现在的vue、react年代引入的Virtual DOM   模板引擎的变了

变成了数据加上模板最后生成Virtual DOM

在vue 3 中，我们的模板就会给抽象成render函数，

比如：

```html
<div id="demo">
  <!-- <div class="currentBranchS">
    11111
  </div>
  <div @click="handleClick">
    {{currentBranch}}
  </div>
  <div v-for=" i in 5">
    {{i}}
  </div>
  <div @click="handleClick">
    {{double}}
  </div> -->
  <div @click="handle">
    点击切换
  </div>
  <div @click="handle1">
    点击切换1
  </div>
  <div v-if="falg">{{num}}</div>
  <div v-else>{{num1}}</div>
</div>
```

```js
const _Vue = Vue
const { createElementVNode: _createElementVNode, createCommentVNode: _createCommentVNode } = _Vue
const _hoisted_1 = ["onClick"]
const _hoisted_2 = ["onClick"]
const _hoisted_3 = { key: 0 }
const _hoisted_4 = { key: 1 }
return function render(_ctx, _cache) {
  with (_ctx) {
    const { createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, Fragment: _Fragment } = _Vue

    return (_openBlock(), _createElementBlock(_Fragment, null, [
      _createCommentVNode(" <div class=\"currentBranchS\">\n    11111\n  </div>\n  <div @click=\"handleClick\">\n    {{currentBranch}}\n  </div>\n  <div v-for=\" i in 5\">\n    {{i}}\n  </div>\n  <div @click=\"handleClick\">\n    {{double}}\n  </div> "),
      _createElementVNode("div", { onClick: handle }, " 点击切换 ", 8 /* PROPS */, _hoisted_1),
      _createElementVNode("div", { onClick: handle1 }, " 点击切换1 ", 8 /* PROPS */, _hoisted_2),
      falg
        ? (_openBlock(), _createElementBlock("div", _hoisted_3, _toDisplayString(num), 1 /* TEXT */))
        : (_openBlock(), _createElementBlock("div", _hoisted_4, _toDisplayString(num1), 1 /* TEXT */))
    ], 64 /* STABLE_FRAGMENT */))
  }
}
```

而render 函数执行的结果就应该是一个vdom  

### Virtual DOM

Virtual DOM 他就是个js 对象

```js
{
    tag: "div",
    props: {},
    children: [
        "Hello World", 
        {
            tag: "ul",
            props: {},
            children: [{
                tag: "li",
                props: {
                    id: 1,
                    class: "li-1"
                },
                children: ["第", 1]
            }]
        }
    ]
}
```

他对应的就是表达的dom 

```html
<div>
    Hello World
    <ul>
        <li id="1" class="li-1">
            第1
        </li>
    </ul>
</div>
```

为何组件要从直接产出 `html` 变成产出 `Virtual DOM` 呢？其原因是 `Virtual DOM` 带来了 **分层设计**，它对渲染过程的抽象，使得框架可以渲染到 `web`(浏览器) 以外的平台，以及能够实现 `SSR` 等 ，并不是Virtual DOM 的性能好 具体

[网上都说操作真实 DOM 慢，但测试结果却比 React 更快，为什么？](https://www.zhihu.com/question/31809713)

## vue中的组件

我们日常写的组件

```js

 <template>
    <div>
   	 这是一个组件{{num}}
    </div>
</template>
<script>
export default {
name:home
  setup(){
    const num=ref(1)
    return {num}
  }
};
</script>
```

编译后的结果

```js
const home={
	 setup(){
    const num=ref(1)
     function handleClick() {
        num.value++
      }
    	return {num,handleClick}
  },
  render(){
   with (_ctx) {
    const { toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock } = _Vue
    return (_openBlock(), _createElementBlock("div", { onClick: handleClick }, " 这是一个组件" + _toDisplayString(num), 9 /* TEXT, PROPS */, _hoisted_1))
  }
  }
}
```

​	其实你发现他就是个配置对象，里面包含了数据，操作数据的方法，以及编译后的模板模板函数

​	而在我们使用的时候 给抽象成标签引用 

```html
<template>
  <div><home></home></div>
</template>
```

最后编译后的结果

```js
const elementVNode = {
  tag: 'div',
  data: null,
  children: {
    tag: home,
    data: null
  }
}
```

这样一来我们就达成了组件化开发的目的,通过搭积木的方式来完成整个页面的渲染

![image-20220310194746727](/Users/a58/Library/Application Support/typora-user-images/image-20220310194746727.png)

# 渲染器

所谓渲染器，简单的说就是将 搭积木形成`Virtual DOM` 渲染成特定平台下真实 `DOM` 的工具(就是一个函数，通常叫 `render`)，渲染器的工作流程分为两个阶段：`mount` 和 `patch`，如果旧的 `VNode` 存在，则会使用新的 `VNode` 与旧的 `VNode` 进行对比，试图以最小的资源开销完成 `DOM` 的更新，这个过程就叫 `patch`，或“打补丁”。如果旧的 `VNode` 不存在，则直接将新的 `VNode` 挂载成全新的 `DOM`，这个过程叫做 `mount`。

在此之前我们先来看 Virtual DOM的种类

![image-20220310195250119](/Users/a58/Library/Application Support/typora-user-images/image-20220310195250119.png)

对应的在vue中也通过二进制位的方式来表示vnode类型

```js
export const enum ShapeFlags {
  ELEMENT = 1, // 普通节点
  FUNCTIONAL_COMPONENT = 1 << 1,//2 // 函数组件
  STATEFUL_COMPONENT = 1 << 2,//4 // 普通组件
  TEXT_CHILDREN = 1 << 3,//8 // 文本子节点
  ARRAY_CHILDREN = 1 << 4,//16 // 数组子节点
  SLOTS_CHILDREN = 1 << 5,//32
  TELEPORT = 1 << 6,//64 // 传送门
  SUSPENSE = 1 << 7,//128 // 可以在组件中异步
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,//256
  COMPONENT_KEPT_ALIVE = 1 << 9,//512// keepALIVE
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 6 表示函数组件和普通组件
}
```

而有了这些类型区分，我们就能通过不同的类型来执行不同的挂载逻辑以及patch 逻辑

```js
  switch (type) {
      // 文本节点
      case Text:
        processText(n1, n2, container, anchor)
        break
      // 注释节点
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      // 静态节点， 这个应该是在ssr的时候用到的
      // 因为只有在ssr的时候才会常见static类型的vnode
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, isSVG)
        } else if (__DEV__) {
          patchStaticNode(n1, n2, container, isSVG)
        }
        break
      // Fragment 片段
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        )
        break
      default:
        // 去除了特殊情况节点的渲染，就是正常的vnode 渲染
        // 如果是个节点类型
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          )
          // 如果是个组件类型
          // 第一次执行挂载时候也被当做组件类型初始化的
          // vue3改版之后直接用配置去常见对象去创建组件vnode
          // 这个配置需要用一个函数去拿，也是动态加载的
          // 传入名字在运行时去去通过resolvecompinent 来拿
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          )
          // 如果是个传送门
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ; (type as typeof TeleportImpl).process(
            n1 as TeleportVNode,
            n2 as TeleportVNode,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized,
            internals
          )
          // Suspense  实验性内容
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          ; (type as typeof SuspenseImpl).process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized,
            internals
          )
        }
    }
```



![image-20220310201315132](/Users/a58/Library/Application Support/typora-user-images/image-20220310201315132.png)

### 渲染器中的diff

我们上文说道，之所以采用Virtual DOM 的目的不是为了性能，而是为了跨平台，所以，当页面大量的内容更新的时候性能就没法保证，就需要有一种算法来减小DOM操作的性能开销

市面上的diff 算法原理基本原理核心Diff同层对比，不做跨层级对比，这样能大大减少js 的计算，而在同层对比的核心算法上出现了不同的流派

* `React` 系列的diff 算法 ---从前到后找到需要移动的节点
* 双端diff---从两端往中间遍历找到需要移动的节点
* 最长递归子序列diff---通过求解最长递归子序列找到需要移动的节点

vue3目前使用的是 [inferno](https://github.com/infernojs/inferno) 其中的核心算法就是最长递归子序列



### 组件挂载

组件挂载 就是组件类型的vnode 节点的初始化 ，其中包含依赖收集，也就是响应式内容

![image-20220310222054888](/Users/a58/Library/Application Support/typora-user-images/image-20220310222054888.png)

```js
  function setupRenderEffect(instance) {
    const componentUpdateFn = () => {
      // 
      const n2 = instance.render()
      patch(null, n2)
    }
    // ReactiveEffect 依赖收集的核心
    const effect = instance.effect = new ReactiveEffect(componentUpdateFn)
    instance.update = effect
    effect()
  }
  function mountComponent(n1, n2) {
    // 组件初始化，包含响应式初始化，依赖收集，生命周期,编译等
    setupComponent(instance)
    //生成effect
    setupRenderEffect()
  }
  // setup 
  function setupComponent(instance) {
    //编译逻通过compile 编译模板生成render 函数
    instance.render = compile(template, finalCompilerOptions)
  }
  // 处理当前结果
  function handleSetupResult(instance, setupResult) {
    instance.setupState = proxyRefs(setupResult)
    finishComponentSetup(instance)
  }
  function setupStatefulComponent(instance) {
    const { setup } = instance
    const setupResult = setup()
    function setupStatefulComponent(instance) {
      handleSetupResult(instance, setupResult)
    }

    // 编译逻辑
    function finishComponentSetup() {

    }
    function updateComponent(n1, n2) {
      //组件更新逻辑
    }
    function processComponent(n1, n2) {
      if (n1 === null) {
        mountComponent(n1, n2)
      } else {
        updateComponent(n1, n2)
      }
    }

    function patch(n1, n2) {
      if (shapeFlag & ShapeFlags.COMPONENT) {
        processComponent()
      }
    }
```





### ReactiveEffect 

ReactiveEffect是依赖收集的关键，他通过一个dep 简历了响应式数据和  ReactiveEffect 的关系dep 中保存了ReactiveEffect ，而一个响应式数据又会有个dep 小管家管理了与之相关的ReactiveEffect 这样的时候当响应式数据变化的时候，会触发dep小管家，去批量处理他里面的ReactiveEffect 去做更新，注意在组件化中，一个组件只有一个渲染ReactiveEffect 



 

 ## 编译器

vue3之所以会有很大的性能提升，编译器起到了很大的作用，由于模板的可遍历性，所以在编译阶段可以做很多优化

### 

### Parse 阶段

**Parse**也就是分词，利用状态机，给模板转化我一个个token，然后在将token转换为语法抽象树 **AST**。

### Transform 阶段

在转换阶段，**Vue** 将对 **AST** 执行一些转换操作,vue的一些的hoistStatic 静态提升 、cacheHandlers 缓存函数  PatchFlags补丁标识 都是在这个阶段处理的

### Codegen阶段

生成render函数

# 为什么vue3会有大幅度的性能提升

 还没梳理完，后期会给他更新在github里

 https://github.com/yixinagqingyuan/vue-next-analysis

# 为什么要看vue源码

* 可能是市面上最先进的工程化方案
* ts 的最佳学习教材
* 规范可维护的代码质量，优雅的代码技巧，
* 开发时能针对性的性能优化，以及封装
* 更快的定位工作中遇到的问题

 ```js
   const { createVNode, render, ref } = Vue
         const message = {
             setup() {
                 const num = ref(1)
                 return {
                     num
                 }
             },
             template: `<div>
                         <div>{{num}}</div>
                         <div>这是一个弹窗</div>
                       </div>`
         }
         const vm = createVNode(message)
         const container = document.createElement('div')
         //通过patch 变成dom
         render(vm, container)
         document.body.appendChild(container.firstElementChild)
 ```

```html
<template>
    <ul>
      <li v-for="item in activeList" :key="item.id">
        {{ item.title }}
      </li>
    </ul>
</template>

```

```js
<script>
import { computed } from "vue";
const activeList = computed(() => {
  return list.filter( item => {
    return item.isActive
  })
})
</script>
```

```
      // 插件机制技巧
      // 一个全局变量
        let compile
        function registerRuntimeCompiler(_compile) {
            //将当前模板编译器赋值方便当前模板内别的函数能调用到
            //之所以要有这个注册方法，是为了让runtime 中使用
            compile = _compile
        }
        // 如此一来在代码导出时，只需要在在非runtime版本中使用注册方法注册即可
        //finishComponentSetup 内部包含编译逻辑
        function finishComponentSetup(instance) {
            Component = instance.type
            // 只需要判断有没有compile并且有没有render 即可
            if (compile && !Component.render) {
                // 执行编译逻辑
            }

        }
```



```js
//vue3中的柯理化技巧
function makeMap ( str, expectsLowerCase ) {
        var map = Object.create(null);
        var list = str.split(',');
        for (var i = 0; i < list.length; i++) {
            map[list[i]] = true;
        }
        return expectsLowerCase
            ? function (val) { return map[val.toLowerCase()]; }
            : function (val) { return map[val]; }
    }
    var isHTMLTag = makeMap(
        'html,body,base,head,link,meta,style,title,' +
        'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
        'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
        'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
        's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
        'embed,object,param,source,canvas,script,noscript,del,ins,' +
        'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
        'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
        'output,progress,select,textarea,' +
        'details,dialog,menu,menuitem,summary,' +
        'content,element,shadow,template,blockquote,iframe,tfoot'
    );
    var isHTMLTag = isHTMLTag('div');

```

```js
// 函数的拓展性技巧

        function createAppAPI(rootComponent, rootProps = null) {
            const mount = (container) => {
            }
            return { mount }

        }
        function createRenderer() {
            return {
                createApp: createAppAPI()
            }
        }
        function createApp(...args) {
            const app = createRenderer().createApp(...args)
            const { mount } = app
            app.mount = () => {
                console.log('执行自己的逻辑')
                mount()
            }
        }
```



# 最后

看懂vue源码，不一定能让你变的有多强（因为vue 他只是前端这个学科门类的一个部分，整个前端的生态是非常大的） 但是能让你知道什么是好，并且朝着这个好的方向去努力

