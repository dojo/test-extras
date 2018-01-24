import { DNode, WNode, VNode } from '@dojo/widget-core/interfaces';
import { isWNode } from '@dojo/widget-core/d';
import * as diff from 'diff';

function replacer(key: string, value: any) {
	if (typeof value === 'function') {
		return 'function';
	}
	return value;
}

export function formatDNodes(nodes: DNode | DNode[], depth: number = 0) {
	nodes = Array.isArray(nodes) ? nodes : [nodes];
	let tabs = '';
	for (let i = 0; i < depth; i++) {
		tabs = `${tabs}\t`;
	}
	const formattedNode: string = nodes.reduce((result: string, node, index) => {
		if (node === null || node === undefined) {
			return result;
		}
		if (index > 0) {
			result = `${result}\n`;
		}
		result = `${result}${tabs}`;

		if (typeof node === 'string') {
			return `${result}"${node}"`;
		}

		result = `${result}${formatNode(node, tabs)}`;
		if (node.children && node.children.length > 0) {
			result = `${result}, [\n${formatDNodes(node.children, depth + 1)}\n${tabs}]`;
		}
		return `${result})`;
	}, '');
	return formattedNode;
}

function formatProperties(properties: any, tabs: string) {
	properties = Object.keys(properties)
		.sort()
		.reduce((props: any, key) => {
			props[key] = properties[key];
			return props;
		}, {});
	properties = JSON.stringify(properties, replacer, `${tabs}\t`).slice(0, -1);
	return `${properties}${tabs}}`;
}

function formatNode(node: WNode | VNode, tabs: any) {
	const propertyKeyCount = Object.keys(node.properties).length;
	let properties = propertyKeyCount > 0 ? formatProperties(node.properties, tabs) : '{}';
	if (isWNode(node)) {
		let name =
			typeof node.widgetConstructor === 'string'
				? `"${node.widgetConstructor}"`
				: (node.widgetConstructor as any).name;
		return `w(${name}, ${properties}`;
	}
	return `v("${node.tag}", ${properties}`;
}

export function assertRender(actual: DNode | DNode[], expected: DNode | DNode[], message?: string) {
	const parsedActual = formatDNodes(actual);
	const parsedExpected = formatDNodes(expected);
	const diffResult = diff.diffLines(parsedActual, parsedExpected);
	let diffFound = false;
	const parsedDiff = diffResult.reduce((result: string, part, index) => {
		if (index > 0) {
			result = `\n${result}`;
		}
		if (part.added) {
			diffFound = true;
			result = `${result}(A)${part.value}`;
		} else if (part.removed) {
			diffFound = true;
			result = `${result}(E)${part.value}`;
		} else {
			result = `${result}${part.value}`;
		}
		return result;
	}, '');

	if (diffFound) {
		throw new Error(parsedDiff);
	}
}

export default assertRender;
