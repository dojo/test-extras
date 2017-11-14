# @dojo/test-extras

[![Build Status](https://travis-ci.org/dojo/test-extras.svg?branch=master)](https://travis-ci.org/dojo/test-extras)
[![codecov](https://codecov.io/gh/dojo/test-extras/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/test-extras)
[![npm version](https://badge.fury.io/js/%40dojo%2Ftest-extras.svg)](http://badge.fury.io/js/%40dojo%2Ftest-extras)

A package that contains various modules to make it easier to test Dojo 2 with Intern.

**WARNING** This is *alpha* software. It is not yet production ready, so you should use at your own risk.

## Features

### harness()

`harness()` is a function which takes a class that has extended `WidgetBase` and returns an instance that provides an API that
facilitates the testing of the widget class in a way that mimics its actual runtime usage.  What the harness does is render
the widget using the `w()` virtual DOM function and project that virtual DOM to the real DOM.  It adds a *spy* during the
render process of the harnessed widget class so testing can be performed on the render, and provides APIs that allow the sending
of events, setting of properties and children of the widget class, and observing how that changes the virtual DOM render and how
that is actually applied to the DOM.

Any of the methods that require an instance of the widget to operate will automatically ensure the harness instance is attached
to the DOM and rendered.  Additional actions will interact with the widgeting system as they would in real life, meaning the
harnessed widget will follow the lifecycle of a widget as if it were part of a larger application.  The only difference is that
instead of updates to the DOM being applied in an async fashion, the entire harness operates synchronously.

In order to isolate the widget, any sub widgets (`WNode`s or node generated by `w()`) within the render will be swapped out for
special virtual DOM nodes before being sent to the virtual DOM engine for rendering.  These virtual DOM nodes are custom element tags which will look
like `<test--widget-stub data--widget-name="<<widget class name>>"></test--widget-stub>`, where `data--widget-name` will be set
to either the widget class tag or the name of the class (*note* IE11 does not support function names, therefore it will have
`<Anonymous>` as the value of the attribute instead).  The substitution occurs *after* the virtual DOM is compared on an
`.expectRender()` assertion, so expected virtual DOM passed to that function should match what the widget will be expected to
return from its `.render()` implementation.

Basic usage of `harness()` would look like this:

```typescript
import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import harness from '@dojo/test-extras/harness';
import { v, w } from '@dojo/widget-core/d';

import MyWidget from '../../MyWidget';
import css from '../../styles/myWidget.m.css';

registerSuite({
    name: 'MyWidget',

    basic() {
        const widget = harness(MyWidget);

        widget.expectRender(v('div', { classes: css.root }, [
          w('child', {
            key: 'first-child',
            classes: css.child
          })
        ]), 'should render as expected');

        widget.destroy();
    }
});
```

`harness()` requires a class which has extended from `WidgetBase` as the first argument and can take an optional second argument
which is an `HTMLElement` to append the root of the harness to.  By default, it appends its root as the last child of `document.body`.

#### .listener

A reference to a simple stub function to use on an expected render as a placeholder for listener functions in a render.  For
example:

```typescript
widget.expectRender(v('div', {
    onclick: widget.listener
}));
```

Since it would require widgets to break their encapsulation to expose their listeners, the harness does not require the expected
render to have a reference to the actual listener.  The harness only checks if the property exists and that both the actual and expected
values are of `typeof === 'function'`.

#### .callListener()

When working with virtual DOM, it is a common pattern to mix in protected or private listeners to properties of the virtual DOM,
either to supply event listeners to DOM events or deal with higher order widget _events_.  `.callListener()` is designed to make it
easier to invoke these listeners for testing.

_Note:_ This should not be used as a substitute for `.sendEvent()` where DOM events are dispatched to the DOM and follow the
bubbling and canceling supported by the DOM.  You can easily get false positives in your unit tests if you are not using `.sendEvent()`
when dealing with DOM events.  This is mainly designed for calling listeners on sub-widgets when the harness widget is setting
the listener in the properties of the sub-widget.

The function takes up to two arguments.  The first is a string value of the `method` that is expected to be in the properties.
The second is an optional argument of `options`.

_Note:_ Unlike when sending events, there is no _magical_ prepending of `'on'` to the listener property to call.  Therefore if
the `method` in the properties is `'onClick'` the argument passed as `method` should be `'onClick'`.

The options are all optional and are:

|Option|Default|Description|
|------|-------|-----------|
|`args`|`undefined`|An array of arguments to pass the listener when called.|
|`index`|`undefined`|Instead of calling the listener on the `node` argument, resolve the listener by index.  This can be either a number or a string of numbers delimited by a comma (e.g. `"0,1,2"` which would target the 3rd child of the 2nd child of the 1st child of `node`).
|`key`|`undefined`|Locate that target based on the `key` property of the nodes.  This is useful when wanting to target a _named_ sub-widget of a rendered widget.|
|`target`|`undefined`|Instead of using `node`, use `target` instead.  This can be used if you have a complex render and you want to supply the target directly.|
|`thisArg`|determined by `widget-core`|Normally, the rendering of the virtual DOM by `widget-core` will automatically resolving binding and passing of `thisArg` will have no effect on the `this` of the listener.  It is preserved here for compatibility with `support/callListener` where sometimes this needs to be supplied.|

An example:

```typescript
widget.callListener('onClick', {
    args: [ event ],
    key: 'left'
});
```

#### .destroy()

Cleans up the `harness` instance and removes the harness and other rendered DOM from the DOM.  You should *always* call `.destroy()`.
Otherwise you will leave quite a lot of garbage DOM in the document which may have impacts on other tests you will run.

#### .expectRender()

Provide an expected virtual DOM which will be compared with the actual rendered virtual DOM from the widget class.  It *spies*
the result from the harnessed widget's `.render()` return and compares that with the provided expected virtual DOM.  If the `actual`
and `expected` don't match, the method will `throw` an assertion error, usually providing a difference of what was expected and
what was actual.  If they do match, the method simply returns the harness instance.

In order to avoid breaking encapsulation, there are two differences in how the harness will compare actual virtual DOM
and expected:

- Properties with a value which is `typeof function` are simply compared on their existence and that both values are functions.  This is
  because it would be impossible or difficult to obtain references to the actual functions.

Most usage would be replicating the expected render from a widget class:

```typescript
widget.setProperties({
    open: true
});

widget.setChildren('some text');

widget.expectRender(v('div', {
    classes: [ css.root, css.open ],
    onclick: widget.listener
}, [ 'some text' ]));
```

#### .getRender()

This returns the virtual DOM of the last render of the harnessed widget class.  It is intended for advanced introspection.  It is
important to note though that there is some post processing done on the virtual DOM by this point via the `.__render__()` method
on the harnessed class.  In addition, any sub widgets that were rendered (e.g. `WNode`s or returns from `w()`) will have been
replaced with stubs of virtual DOM.

#### .getDom()

Return the root node of the rendered DOM of the widget.  This allows introspection or manipulation of the actual DOM.

#### .mockMeta()

Allows for mocking of meta providers when testing a widget.  The method `.mockMeta()` takes two arguments, first the meta
provider class and the second argument being a map of methods to mock on the provider when the harness widget is created.

For example, to provide mocked `Dimensions` for a widget:

```ts
const widget = harness.widget(MyWidget);

const rootDimensions = {
    offset: { height: 100, left: 100, top: 100, width: 100 },
    position: { bottom: 200, left: 100, right: 200, top: 100 },
    scroll: { height: 100, left: 100, top: 100, width: 100 },
    size: { width: 100, height: 100 }
};
const emptyDimensions = {
    offset: { height: 0, left: 0, top: 0, width: 0 },
    position: { bottom: 0, left: 0, right: 0, top: 0 },
    scroll: { height: 0, left: 0, top: 0, width: 0 },
    size: { width: 0, height: 0 }
};

const handle = widget.mockMeta(Dimensions, {
    get(key: string | number) {
        return key === 'root' ? rootDimensions : emptyDimensions;
    }
});
```

The handle returned from the `.mockMeta` function can be used to remove the mocks.

To facilitate usage under TypeScript, there is a special context type (`MetaMockContext`) that is exported from the `harness` module.
This is designed to represent the run-time context of the mock methods, which will allow access to `this.invalidate()` and
`this.getNode()` which may be required to create an appropriate mock.

For example, to invalidate a widget via the meta provider mock:

```ts
import harness, { MetaMockContext } from '@dojo/text-extras/harness';

const widget = harness.widget(MyWidget);

widget.mockMeta(Dimensions, {
    get(this: MetaMockContext<Dimensions>, key: string | number) {
        this.invalidate();
        return {}
    }
})
```

#### .sendEvent()

Dispatch an event to the DOM of the rendered widget.  The first argument is the type of the event to dispatch to the root
of the widget's rendered DOM.  The second is an optional object literal of additional options:

|Option|Description|
|------|-----------|
|`eventClass`|A string that matches the class of event to use (e.g. `MouseEvent`).  By default, `CustomEvent` is used.|
|`eventInit`|Any properties that should be part of initialising the event.  Note that `bubbles` and `cancelable` are `true` by default, which is different then if you were creating events directly.|
|`key`|A virtual DOM `key` that identifies the DOM node to dispatch an event to.  Makes it easy to select a part of the widget's rendered DOM for targeting the event.|
|`selector`|A string selector to be applied to the root DOM element of the rendered widget.  Makes it easy to sub-select a part of the widget's rendered DOM for targeting the event.|
|`target`|By default, the widget's render root element is used.  This property substitutes a specific target to dispatch the event to.|

Using event classes other than `CustomEvent` can sometimes be challenging, as cross browser support is sometimes difficult to achieve.
In most use cases, assuming the widget is not expecting an event of a particular class, custom events should be fine.

An example of clicking on a widget:

```typescript
widget.sendEvent('click');
```

An example of swiping right on a widget's last child:

```typescript
widget.sendEvent('touchstart', {
    eventInit: {
        changedTouches: [ { screenX: 50 } ]
    },
    selector: ':last-child'
});

widget.sendEvent('touchmove', {
    eventInit: {
        changedTouches: [ { screenX: 150 } ]
    },
    selector: ':last-child'
});

widget.sendEvent('touchend', {
    eventInit: {
        changedTouches: [ { screenX: 150 } ]
    },
    selector: ':last-child'
});
```

#### .setChildren()

Provide children that should be passed to the widget class as it is rendered. These are typically passed by an upstream widget by
invoking a `w(WidgetClass, { }, [ ...children ])`.

Adding an array of children:

```typescript
function generateChildren(): DNode[] {
    return [ 'foo', 'bar', 'baz', 'qat' ]
      .map((text) => v('li', [ text ]));
}

widget.setChildren(...generateChildren());

widget.expectRender(v('ul', generateChildren()));
```

#### .setProperties()

Provide a map of properties to a widget. These are typically passed by an upstream widget by invoking
`w(WidgetClass, { ...properties })`.  For example:

```typescript
widget.setProperties({
    open: true
});

widget.expectRender(v('div', { classes: [ css.root, css.open ] }));
```

### intern/ClientErrorCollector

`ClientErrorCollector` is a class that will collect errors from a remote session with Intern.  This is typically used with
functional tests, when there might be client error messages which are not affecting the functionality of the test, but are
undesired.

Typical usage would be as follows:
* Create an instance of the `ClientErrorCollector` providing the remote session.
* `.init()` the collector which will install the collection script on the remote client.
* Run whatever additional tests are desired.
* Call `.finish()`, which will resolve with any errors that were collected, or call `.assertNoErrors()`.  `.assertNoErrors()` either resolves if there
were no errors, or rejects with the first error collected.

For example:

```typescript
import * as assert from 'intern/chai!assert';
import * as registerSuite from 'intern!object';
import * as Suite from 'intern/lib/Suite';
import ClientErrorCollector from '@dojo/test-extras/intern/ClientErrorCollector';

registerSuite({
  name: 'Test',

  'functional testing'(this: Suite) {
    const collector = new ClientErrorCollector(this.remote);
    return this.remote
      .get('SomeTest.html')
      .then(() => collector.init())
      .execute(() => {
        /* some test code */
      })
      .then(() => collector.assertNoErrors());
  }
});
```

### support/assertRender()

`assertRender()` is an assertion function that throws when there is a discrepancy between an actual Dojo virtual DOM (`DNode`)
and the expected Dojo virtual DOM.

Typically, this would be used with the Dojo virtual DOM functions `v()` and `w()` provided in `@dojo/widget-core/d` in the following
way:

```typescript
import { v } from '@dojo/widget-core/d';
import assertRender from '@dojo/test-extras/support/assertRender';

function someRenderFunction () {
  return v('div', { styles: { 'color': 'blue' } }, [ 'Hello World!' ]);
}

assertRender(someRenderFunction(), v('div', {
    styles: {
      'color': 'blue'
    }
  }, [ 'Hello World!' ]), 'renders should match');
```

There are some important things to note about how `assertRender()` compares `DNode`s.

First, on function values of the properties of a `DNode`, their equality is simply compared on the presence of the value and that
both actual and expected values are `typeof` functions.  This is because it is challenging to gain the direct reference of a
function, like an event handler.  If there is a mismatch between the presence of the property or the type of the value,
`assertRender()` will throw.

Second, widget constructors (in `WNode`s/generated by `w()`) are compared by strict equality.  They can be strings (if using the widget
registry), but the actual constructor functions will not be resolved.

Third, `DNode`s will not be rendered during comparison.  Their children will be walked, but if a `DNode`'s rendering causes
additional virtual DOM to be rendered, the additional virtual DOM will not be compared.  For example, in the case of a `w()`/`WNode`
which has a widget constructor that renders additional widgets, those additional widgets will not be compared. If those comparisons
are important, then walking the `DNode` structure and comparing the results using `assertRender()` would need to be done.

### support/callListener

When working with virtual DOM, it is a common pattern to mix in protected or private listeners to properties of the virtual DOM,
either to supply event listeners to DOM events or deal with higher order widget _events_.  `callListener` is a module which exports
a single default function to make calling these when testing easier.

The function takes up to three arguments.  The first is the `target` that you want to call the listener on, the second is a string
value of the `method` that is expected to be in the properties.  The third is an optional argument of `options`.

_Note:_ Unlike when sending events, there is no _magical_ prepending of `'on'` to the listener property to call.  Therefore if
the `method` in the properties is `'onClick'` the argument passed as `method` should be `'onClick'`.

The options are all optional and are:

|Option|Default|Description|
|------|-------|-----------|
|`args`|`undefined`|An array of arguments to pass the listener when called.|
|`index`|`undefined`|Instead of calling the listener on the `node` argument, resolve the listener by index.  This can be either a number or a string of numbers delimited by a comma (e.g. `"0,1,2"` which would target the 3rd child of the 2nd child of the 1st child of `node`).
|`key`|`undefined`|Locate that target based on the `key` property of the nodes.  This is useful when wanting to target a _named_ sub-widget of a rendered widget.|
|`target`|`undefined`|Instead of using `node`, use `target` instead.  This is designed for supporting integration into other APIs and is not useful by itself.|
|`thisArg`|`undefined`|By default, the resolved listener will be called with a `this` of `undefined`. Alternatively you can supply a `thisArg` to provide a different `this` when calling.|

An example:

```typescript
const node = v('div', { key: 'root' }, [
    w('sub-widget', { key: 'left', onClick: listener }, [ 'content' ]),
    w('sub-widget', { key: 'right', onClick: listener }, [ 'content' ])
]);

callListener(node, 'onClick', {
    args: [ event ],
    key: 'left'
});
```

### support/d

In testing expected virtual DOM, it can be overly verbose to regenerate your virtual DOM every time you have changed the conditions
that might effect the render.  Therefore the `support/d` module contains some helper functions which can be used to manipulate
virtual DOM once it has been generated by the `v()` and `w()` virtual DOM functions.

#### assignChildProperties()

Shallowly assigns properties of a `WNode` or `HNode` indicated by an index.  The index can be a number, or it can be a string of numbers
separated by commas to target a deeper child.  For example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { value: '3' }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

assignChildProperties(expected, '0,2', { classes: css.highlight });
```

#### assignChildPropertiesByKey()

Shallowly assigns properties of a `WNode` or `HNode` specified by its key. For example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { key: 'a', value: '3' }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

assignChildPropertiesByKey(expected, 'a', { classes: css.highlight });
```

#### assignProperties()

Shallowly assigns properties to a `WNode` or `HNode`.  For example:

```typescript
const expected = v('div', {
    classes: css.root,
    onclick: widget.listener
}, [ 'content' ]);

assignProperties(expected, {
    classes: [ css.root, css.open ]
});
```

### compareProperty()

Returns an object which is used in render assertion comparisons like `harness.expectRender()` or `assertRender()`.  This is designed
to allow validation of property values that are difficult to know or obtain references to until the widget has rendered (e.g. registries or dynamically generated IDs).

The function takes a single argument, `callback`, which is a function that will be called when the property value needs to be validated.
This `callback` can take up to three arguments.  The first is the `value` of the property to check, the second is the `name` of the
property, and `parent` is either the actual `WidgetProperties` or `VirtualDomProperties` that this value is from.  If the value is _valid_,
then the function should return `true`. If the value is _not valid_, returning `false` will cause an `AssertionError` to be thrown, naming
the property which has an unexpected value.

*Note:* The type of the return value can often not be valid for the property value that you are passing it for.  You may need to cast
it as `any` in order to allow TypeScript type checking to succeed.

An example of usage would be:

```ts
import { compareProperty } from '@dojo/test-extras/support/d';

const compareRegistryProperty = compareProperty((value) => {
    return value instanceof Registry;
});

widget.expectRender(v('div', {}, [
    w('child', { registry: compareRegistryProperty })
]));
```

### findIndex()

Returns a node identified by the supplied `index`.  The first argument is the _root_ virtual DOM node (`WNode` or `HNode`) and the
second argument is the `index` being searched for.  Indexes can be either numbers, or a string of comma delimited numbers which
specify the deeper index.  For example a string of `0,1,2` would get the third child of the second child of the first child of the
_root_.  If resolved, the function will return the `DNode`, otherwise it returns `undefined`.

An example:

```typescript
const vdom = const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { value: 3 }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

findIndex(vdom, '0,0,0'); // returns 'foo'
```

### findKey()

Returns a node identified by the supplied `key`.  The first argument is the _root_ virutal DOM node (`WNode` or `HNode`) and the
second argument is the `key` being searched for.  If found, the function will return the `WNode` or `HNode`, otherwise it returns
`undefined`.

An example:

```typescript
const vdom = const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { key: 'foo' }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

findKey(vdom, 'foo'); // returns `v('li', { key: 'foo' }, [ 'foo' ])`
```

#### replaceChild()

Replaces a child in a `WNode` or `HNode` with another, specified by an index.  The index can be either a number, or a string of
numbers separated by commas to target a deeper child.  If the target child does not have any children, a child array will be created
prior to the child being added.  Also note that it is quite easy to generate sparse arrays, as there is no range checking on the
index.

An example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { value: '3' }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

replaceChild(expected, '0,0,0', 'qat');
replaceChild(expected, '0,2', v('span'));
```

#### replaceChildByKey()

Replaces a child in a `WNode` or `HNode` with another, specified by a unique key. If more than one child has the same key,
a warning will be logged but the first node found will be replaced.

An example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { key: 'a', value: '3' }, [ 'foo' ]),
        v('li', { key: 'b' }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

replaceChildByKey(expected, 'a', 'qat');
replaceChildByKey(expected, 'b', v('span'));
```

#### replaceChildProperties()

Replace a map of properties on a child specified by the index.  The index can be either a number, or a string of numbers
separated by commas to target a deeper child.  Different than `assignChildProperties` which *mixes-in* properties, this is a
wholesale replacement.  For example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { value: '3' }, [ 'foo' ]),
        v('li', { }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

replaceChildProperties(expected, '0,2', {
    classes: css.highlight
    value: '6'
});
```

#### replaceChildPropertiesByKey()

Replace a map of properties on a child specified by the key. Different than `assignChildPropertiesByKey` which *mixes-in* properties, this is a
wholesale replacement. Since all properties are replaced, the key will be lost if not provided as part of the updated properties. For example:

```typescript
const expected = v('div', [
    v('ol', { type: 'I' }, [
        v('li', { value: '3' }, [ 'foo' ]),
        v('li', { key: 'b' }, [ 'bar' ]),
        v('li', { }, [ 'baz' ])
    ])
]);

replaceChildPropertiesByKey(expected, 'b', {
	key: 'b',
    classes: css.highlight,
    value: '6'
});
```

#### replaceProperties()

Replaces properties on a `WNode` or `HNode`.  For example:

```typescript
const expected = v('div', {
    classes: css.root,
    onclick: widget.listener
}, [ 'content' ]);

assignProperties(expected, {
    classes: [ css.root, css.open ],
    onclick: widget.listener
});
```

### support/loadJsdom

`loadJsdom` is a module which will attempt to load `jsdom` in environments where there appears to be no global `document` object
(e.g. NodeJS).  If it detects `jsdom` needs to be loaded, it will create a global `document` and `window` as well as provide a
couple of key shims/polyfills to support certain feature detections needed by Dojo 2.

The module's default export is a reference to `document`, either the created one, or the one that is already there.  It will
essentially be a "noop" if it is running in a browser environment, so it is safe to load without knowing what sort of environment
you are running in.

Typical usage would be to load the module before starting any client unit tests that need a browser environment:

```typescript
import '@dojo/test-extras/support/loadJsdom';
import 'testModule';
```

### support/sendEvent()

Dispatch an event to a specified DOM element.  The first argument is the target, the second argument is the type of the event to
dispatch to the target.  The third is an optional object of additional options:

|Option|Description|
|------|-----------|
|eventClass|A string that matches the class of event to use (e.g. `MouseEvent`).  By default, `CustomEvent` is used.|
|eventInit|Any properties that should be part of initialising the event.  Note that `bubbles` and `cancelable` are `true` by default, which is different then if you were creating events directly.|
|selector|A string selector to be applied to the target element.|

An example of clicking on a button:

```typescript
const button = document.createElement('button');
document.body.appendChild(button);
sendEvent(button, 'click');
```

An example of swiping right on a `div`:

```typescript
const div = document.createElement('div');
document.body.appendChild(div);

sendEvent(div, 'touchstart', {
    eventInit: {
        changedTouches: [ { screenX: 50 } ]
    }
});

sendEvent(div, 'touchmove', {
    eventInit: {
        changedTouches: [ { screenX: 150 } ]
    }
});

sendEvent(div, 'touchend', {
    eventInit: {
        changedTouches: [ { screenX: 150 } ]
    }
});
```

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines and Style Guide.

### Installation

To start working with this package, clone the repository and run `npm install`.

In order to build the project, run `grunt dev` or `grunt dist`.

## Testing

Test cases MUST be written using [Intern](https://theintern.github.io) using the Object test interface and Assert assertion interface.

90% branch coverage MUST be provided for all code submitted to this repository, as reported by istanbul’s combined coverage results for all supported platforms.

To test locally in node run:

`grunt test`

To test against browsers with a local selenium server run:

`grunt test:local`

To test against BrowserStack or Sauce Labs run:

`grunt test:browserstack`

or

`grunt test:saucelabs`

## Licensing information

- `src/support/AssertionError` is adapted from [assertion-error](https://github.com/chaijs/assertion-error)
  and is © 2013 Jake Luer and [MIT Licensed](http://opensource.org/licenses/MIT)

© [JS Foundation](https://js.foundation/) & contributors. [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
