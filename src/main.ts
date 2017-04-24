import harness from './harness';
import ClientErrorCollector from './intern/ClientErrorCollector';
import assertRender from './support/assertRender';
import sendEvent from './support/sendEvent';
import { assignChildProperties, assignProperties, replaceChild, replaceChildProperties, replaceProperties } from './support/virtualDom';

export {
	assertRender,
	assignChildProperties,
	assignProperties,
	ClientErrorCollector,
	harness,
	replaceChild,
	replaceChildProperties,
	replaceProperties,
	sendEvent
};
