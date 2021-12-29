//todo此条目是“完整构建”，包括运行时和和编译器，并支持动态编译模板选项。
import { initDev } from './dev'
// 引入 compile内容 CompilerOptions type  CompilerError interface
import { compile, CompilerOptions, CompilerError } from '@vue/compiler-dom'
//莫不敢注册函数 RenderFunction type warn警告函数
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
// 全量导出runtimeDom
import * as runtimeDom from '@vue/runtime-dom'
// 工具函数相关 
import { isString, NOOP, generateCodeFrame, extend } from '@vue/shared'
import { InternalRenderFunction } from 'packages/runtime-core/src/component'
// 如果是开发环境，暂时先不考虑
if (__DEV__) {
  initDev()
}
// 新建一个空对象，为了缓存已经编译过的模板
const compileCache: Record<string, RenderFunction> = Object.create(null)
/**
 *  模板编译方法入口
 * @param template 
 * @param options 
 * @returns 
 */
function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions
): RenderFunction {
  // 判断字符情况
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    } else {
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }

  if (template[0] === '#') {
    const el = document.querySelector(template)
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    template = el ? el.innerHTML : ``
  }

  const { code } = compile(
    template,
    extend(
      {
        hoistStatic: true,
        onError: __DEV__ ? onError : undefined,
        onWarn: __DEV__ ? e => onError(e, true) : NOOP
      } as CompilerOptions,
      options
    )
  )

  function onError(err: CompilerError, asWarning = false) {
    const message = asWarning
      ? err.message
      : `Template compilation error: ${err.message}`
    const codeFrame =
      err.loc &&
      generateCodeFrame(
        template as string,
        err.loc.start.offset,
        err.loc.end.offset
      )
    warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  const render = (
    __GLOBAL__ ? new Function(code)() : new Function('Vue', code)(runtimeDom)
  ) as RenderFunction

    // mark the function as runtime compiled
    ; (render as InternalRenderFunction)._rc = true

  return (compileCache[key] = render)
}
// 注册当前方法 ，个人理解，之所以这样做是为了将template的获取外置，防止污染内部逻辑，减少代码内部为了兼容处理而产生的涌余
registerRuntimeCompiler(compileToFunction)
// 导出当前方法
// todo 注意，在函数开始之前并没有做很多初始化，而是只做了个注册，将编译器赋值给一个变量，为了方便调用到
export { compileToFunction as compile }
//导出所有runtime-dom方法
export * from '@vue/runtime-dom'
