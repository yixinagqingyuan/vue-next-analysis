import {
  ComponentInternalInstance,
  FunctionalComponent,
  Data,
  getComponentName
} from './component'
import {
  VNode,
  normalizeVNode,
  createVNode,
  Comment,
  cloneVNode,
  VNodeArrayChildren,
  isVNode,
  blockStack
} from './vnode'
import { handleError, ErrorCodes } from './errorHandling'
import { PatchFlags, ShapeFlags, isOn, isModelListener } from '@vue/shared'
import { warn } from './warning'
import { isHmrUpdating } from './hmr'
import { NormalizedProps } from './componentProps'
import { isEmitListener } from './componentEmits'
import { setCurrentRenderingInstance } from './componentRenderContext'
import {
  DeprecationTypes,
  isCompatEnabled,
  warnDeprecation
} from './compat/compatConfig'

/**
 * dev only flag to track whether $attrs was used during render.
 * If $attrs was used during render then the warning for failed attrs
 * fallthrough can be suppressed.
 */
let accessedAttrs: boolean = false

export function markAttrsAccessed() {
  accessedAttrs = true
}
// 生成vonde 的地方
export function renderComponentRoot(
  instance: ComponentInternalInstance
): VNode {
  // 取出实例中的相关内容
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    data,
    setupState,
    ctx,
    inheritAttrs
  } = instance

  let result
  let fallthroughAttrs
  // 两个功能保存当前instance，返回上一个 instance
  const prev = setCurrentRenderingInstance(instance)
  // dev 暂时不看
  if (__DEV__) {
    accessedAttrs = false
  }

  try {
    // 判断是不是普通组件
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // withProxy is a proxy with a different `has` trap only for
      // runtime-compiled render functions using `with` block.
      //withProxy是一个仅针对
      //运行时使用`with`块编译渲染函数。
      const proxyToUse = withProxy || proxy
      // 这个reslut 就是vnode 
      // 经过测试，render的返回值是第二个参数，的一个参数是为了block
      result = normalizeVNode(
        render!.call(
          proxyToUse,
          proxyToUse!,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      )
      // 赋值Attribute
      fallthroughAttrs = attrs
    } else {
      // functional
      const render = Component as FunctionalComponent
      // in dev, mark attrs accessed if optional props (attrs === props)
      if (__DEV__ && attrs === props) {
        markAttrsAccessed()
      }
      result = normalizeVNode(
        render.length > 1
          ? render(
            props,
            __DEV__
              ? {
                get attrs() {
                  markAttrsAccessed()
                  return attrs
                },
                slots,
                emit
              }
              : { attrs, slots, emit }
          )
          : render(props, null as any /* we know it doesn't need it */)
      )
      fallthroughAttrs = Component.props
        ? attrs
        : getFunctionalFallthrough(attrs)
    }
  } catch (err) {
    // 报错的情况下的兼容处理
    blockStack.length = 0
    handleError(err, instance, ErrorCodes.RENDER_FUNCTION)
    result = createVNode(Comment)
  }

  // attr merging
  // in dev mode, comments are preserved, and it's possible for a template
  // to have comments along side the root element which makes it a fragment
  //attr合并
  //在开发模式下，注释会被保留，并且可以使用模板
  //在根元素旁边添加注释，使其成为一个片段
  // 如果能拿到render 的结果就赋值root 
  let root = result
  let setRoot: ((root: VNode) => void) | undefined = undefined
  // dev 情况暂时不看
  if (
    __DEV__ &&
    result.patchFlag > 0 &&
    result.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    ;[root, setRoot] = getChildRoot(result)
  }
  // 如果有Attribute
  //“fallthrough 属性”是v-on传递给组件的属性或事件侦听器，但未在接收组件的props或emits中显式声明。这方面的常见示例包括class、style和id属性。
  if (fallthroughAttrs && inheritAttrs !== false) {
    // 拿到所有的属性名字
    const keys = Object.keys(fallthroughAttrs)
    // 获取节点类型
    const { shapeFlag } = root
    if (keys.length) {
      // |和& 的运算顺序没有优先级，为从左到右，当前代码中，由于 有括号 先算括号111
      //  当前的条件要想命中，必须shapeFlag必须在当前二级制位的一位上，结果才能为ture 
      // 换句话说就是当前类型要如果是普通节点类型，或者组件类型
      if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
        if (propsOptions && keys.some(isModelListener)) {
          // If a v-model listener (onUpdate:xxx) has a corresponding declared
          // prop, it indicates this component expects to handle v-model and
          // it should not fallthrough.
          // related: #1543, #1643, #1989
          // 做一个简单的排除，将props 以及 vmodel 的情况，只保留常规的内容
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions
          )
        }
        // 克隆一个节点并且将 这也常规的attr 加入进去
        root = cloneVNode(root, fallthroughAttrs)
      } else if (__DEV__ && !accessedAttrs && root.type !== Comment) {
        const allAttrs = Object.keys(attrs)
        const eventAttrs: string[] = []
        const extraAttrs: string[] = []
        for (let i = 0, l = allAttrs.length; i < l; i++) {
          const key = allAttrs[i]
          if (isOn(key)) {
            // ignore v-model handlers when they fail to fallthrough
            if (!isModelListener(key)) {
              // remove `on`, lowercase first letter to reflect event casing
              // accurately
              eventAttrs.push(key[2].toLowerCase() + key.slice(3))
            }
          } else {
            extraAttrs.push(key)
          }
        }
        if (extraAttrs.length) {
          warn(
            `Extraneous non-props attributes (` +
            `${extraAttrs.join(', ')}) ` +
            `were passed to component but could not be automatically inherited ` +
            `because component renders fragment or text root nodes.`
          )
        }
        if (eventAttrs.length) {
          warn(
            `Extraneous non-emits event listeners (` +
            `${eventAttrs.join(', ')}) ` +
            `were passed to component but could not be automatically inherited ` +
            `because component renders fragment or text root nodes. ` +
            `If the listener is intended to be a component custom event listener only, ` +
            `declare it using the "emits" option.`
          )
        }
      }
    }
  }

  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance) &&
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT &&
    root.shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)
  ) {
    const { class: cls, style } = vnode.props || {}
    if (cls || style) {
      if (__DEV__ && inheritAttrs === false) {
        warnDeprecation(
          DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE,
          instance,
          getComponentName(instance.type)
        )
      }
      root = cloneVNode(root, {
        class: cls,
        style: style
      })
    }
  }

  // inherit directives
  if (vnode.dirs) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Runtime directive used on component with non-element root node. ` +
        `The directives will not function as intended.`
      )
    }
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs
  }
  // inherit transition data
  if (vnode.transition) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Component inside <Transition> renders non-element root node ` +
        `that cannot be animated.`
      )
    }
    root.transition = vnode.transition
  }

  if (__DEV__ && setRoot) {
    setRoot(root)
  } else {
    result = root
  }

  setCurrentRenderingInstance(prev)
  return result
}

/**
 * dev only
 * In dev mode, template root level comments are rendered, which turns the
 * template into a fragment root, but we need to locate the single element
 * root for attrs and scope id processing.
 */
const getChildRoot = (
  vnode: VNode
): [VNode, ((root: VNode) => void) | undefined] => {
  const rawChildren = vnode.children as VNodeArrayChildren
  const dynamicChildren = vnode.dynamicChildren
  const childRoot = filterSingleRoot(rawChildren)
  if (!childRoot) {
    return [vnode, undefined]
  }
  const index = rawChildren.indexOf(childRoot)
  const dynamicIndex = dynamicChildren ? dynamicChildren.indexOf(childRoot) : -1
  const setRoot = (updatedRoot: VNode) => {
    rawChildren[index] = updatedRoot
    if (dynamicChildren) {
      if (dynamicIndex > -1) {
        dynamicChildren[dynamicIndex] = updatedRoot
      } else if (updatedRoot.patchFlag > 0) {
        vnode.dynamicChildren = [...dynamicChildren, updatedRoot]
      }
    }
  }
  return [normalizeVNode(childRoot), setRoot]
}

export function filterSingleRoot(
  children: VNodeArrayChildren
): VNode | undefined {
  let singleRoot
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      // ignore user comment
      if (child.type !== Comment || child.children === 'v-if') {
        if (singleRoot) {
          // has more than 1 non-comment child, return now
          return
        } else {
          singleRoot = child
        }
      }
    } else {
      return
    }
  }
  return singleRoot
}

const getFunctionalFallthrough = (attrs: Data): Data | undefined => {
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ; (res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}

const filterModelListeners = (attrs: Data, props: NormalizedProps): Data => {
  const res: Data = {}
  for (const key in attrs) {
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key]
    }
  }
  return res
}

const isElementRoot = (vnode: VNode) => {
  return (
    vnode.shapeFlag & (ShapeFlags.COMPONENT | ShapeFlags.ELEMENT) ||
    vnode.type === Comment // potential v-if branch switch
  )
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component!.emitsOptions

  // Parent component's render function was hot-updated. Since this may have
  // caused the child component's slots content to have changed, we need to
  // force the child to update as well.
  if (__DEV__ && (prevChildren || nextChildren) && isHmrUpdating) {
    return true
  }

  // force child update for runtime directive or transition on component vnode.
  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }

  if (optimized && patchFlag >= 0) {
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      if (!prevProps) {
        return !!nextProps
      }
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps, nextProps!, emits)
    } else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps!
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (
          nextProps![key] !== prevProps![key] &&
          !isEmitListener(emits, key)
        ) {
          return true
        }
      }
    }
  } else {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren || nextChildren) {
      if (!nextChildren || !(nextChildren as any).$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }

  return false
}

function hasPropsChanged(
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance['emitsOptions']
): boolean {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (
      nextProps[key] !== prevProps[key] &&
      !isEmitListener(emitsOptions, key)
    ) {
      return true
    }
  }
  return false
}

export function updateHOCHostEl(
  { vnode, parent }: ComponentInternalInstance,
  el: typeof vnode.el // HostNode
) {
  while (parent && parent.subTree === vnode) {
    ; (vnode = parent.vnode).el = el
    parent = parent.parent
  }
}
