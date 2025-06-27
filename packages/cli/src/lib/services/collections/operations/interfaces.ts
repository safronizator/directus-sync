import { DirectusOperation as BaseDirectusOperation } from '@directus/sdk';
import { BaseSchema } from '../base';

interface FlowReference {
  id: string;
}

interface NamedFlowReference extends FlowReference {
  name: string;
}

export type DirectusOperationBase = BaseDirectusOperation<BaseSchema>;

type DirectusOperationWithFlatConnections = Omit<DirectusOperationBase, 'resolve' | 'reject'> & {
  resolve?: string | null;
  reject?: string | null;
}

export type DirectusOperationWithFlow = Omit<DirectusOperationWithFlatConnections, 'flow'> & {
  flow: FlowReference;
}

export type DirectusOperation = DirectusOperationWithFlatConnections & {
  flow: NamedFlowReference;
}