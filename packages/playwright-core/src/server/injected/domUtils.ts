/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function isInsideScope(scope: Node, element: Element | undefined): boolean {
  while (element) {
    if (scope.contains(element))
      return true;
    element = enclosingShadowHost(element);
  }
  return false;
}

export function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return;
  if (element.parentNode.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
}

export function enclosingShadowRootOrDocument(element: Element): Document | ShadowRoot | undefined {
  let node: Node = element;
  while (node.parentNode)
    node = node.parentNode;
  if (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ || node.nodeType === 9 /* Node.DOCUMENT_NODE */)
    return node as Document | ShadowRoot;
}

function enclosingShadowHost(element: Element): Element | undefined {
  while (element.parentElement)
    element = element.parentElement;
  return parentElementOrShadowHost(element);
}

export function closestCrossShadow(element: Element | undefined, css: string): Element | undefined {
  while (element) {
    const closest = element.closest(css);
    if (closest)
      return closest;
    element = enclosingShadowHost(element);
  }
}

export function getElementComputedStyle(element: Element, pseudo?: string): CSSStyleDeclaration | undefined {
  return element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView.getComputedStyle(element, pseudo) : undefined;
}

export function isElementStyleVisibilityVisible(element: Element, style?: CSSStyleDeclaration): boolean {
  style = style ?? getElementComputedStyle(element);
  if (!style)
    return true;
  // Element.checkVisibility checks for content-visibility and also looks at
  // styles up the flat tree including user-agent ShadowRoots, such as the
  // details element for example.
  // @ts-ignore Typescript doesn't know that checkVisibility exists yet.
  if (Element.prototype.checkVisibility) {
    // @ts-ignore Typescript doesn't know that checkVisibility exists yet.
    if (!element.checkVisibility({ checkOpacity: false, checkVisibilityCSS: false }))
      return false;
  } else {
    // Manual workaround for WebKit that does not have checkVisibility.
    const detailsOrSummary = element.closest('details,summary');
    if (detailsOrSummary !== element && detailsOrSummary?.nodeName === 'DETAILS' && !(detailsOrSummary as HTMLDetailsElement).open)
      return false;
  }
  if (style.visibility !== 'visible')
    return false;
  return true;
}

export function isElementVisible(element: Element): boolean {
  // Note: this logic should be similar to waitForDisplayedAtStablePosition() to avoid surprises.
  const style = getElementComputedStyle(element);
  if (!style)
    return true;
  if (style.display === 'contents') {
    // display:contents is not rendered itself, but its child nodes are.
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1 /* Node.ELEMENT_NODE */ && isElementVisible(child as Element))
        return true;
      if (child.nodeType === 3 /* Node.TEXT_NODE */ && isVisibleTextNode(child as Text))
        return true;
    }
    return false;
  }
  if (!isElementStyleVisibilityVisible(element, style))
    return false;
  const rect = element.getBoundingClientRect();
  const visible = rect.width > 0 && rect.height > 0;
  // webkit will report visible nested inline elements to be hidden with zero width
  if (!visible && style.display === 'inline' && rect.height > 0) {
    for (let child = element.firstChild; child; child = child.nextSibling) {
      // webkit has already count all the other children into boudning client rect and form a result of hidden,
      // so here we only need to check the inline children to see if there are any visible inline children
      if (child.nodeType === 1 /* Node.ELEMENT_NODE */) {
        const style = getElementComputedStyle(child as Element);
        if (style?.display === 'inline' && isElementVisible(child as Element))
          return true;
      }
    }
    return false;
  }
  return visible;
}

function isVisibleTextNode(node: Text) {
  // https://stackoverflow.com/questions/1461059/is-there-an-equivalent-to-getboundingclientrect-for-text-nodes
  const range = node.ownerDocument.createRange();
  range.selectNode(node);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
