import { WithSyncIdAndWithoutId } from '../base';
import { Service } from 'typedi';
import { OPERATIONS_COLLECTION } from './constants';
import path from 'path';
import { DirectusOperation } from './interfaces';
import { ConfigService } from '../../config';
import { MigrationClient } from '../../migration-client';
import { FLOWS_COLLECTION } from '../flows';
import { TreeDataLoader } from '../base/data-loader-tree';
import { groupBy } from '../helpers';

const resolveOperationOrder = (
  ops: WithSyncIdAndWithoutId<DirectusOperation>[],
) => {
  const res: WithSyncIdAndWithoutId<DirectusOperation>[] = [];
  const added = new Set<string>();
  const add = (id: string) => {
    const op = ops.find((o) => o._syncId === id);
    if (!op) {
      throw new Error(`Operation ${id} not found`);
    }
    if (op.reject) add(op.reject);
    if (op.resolve) add(op.resolve);
    if (added.has(id)) return;
    added.add(id);
    res.push(op);
  };
  ops.forEach((op) => add(op._syncId));
  return res;
};

@Service()
export class OperationsDataLoader extends TreeDataLoader<DirectusOperation> {
  constructor(config: ConfigService, migrationClient: MigrationClient) {
    const filePath = path.join(
      config.getCollectionsConfig().dumpPath,
      FLOWS_COLLECTION,
    );
    const hooks = config.getCollectionHooksConfig(OPERATIONS_COLLECTION);
    super(
      filePath,
      migrationClient,
      hooks,
      'operations',
      (item) => `${item.flow.name} (${item.flow.id})`,
      true,
    );
  }

  /**
   * Save the data to the dump file. The data is passed through the data transformer.
   */
  async saveData(data: WithSyncIdAndWithoutId<DirectusOperation>[]) {
    const opsGroupedByFlows: Record<
      string,
      WithSyncIdAndWithoutId<DirectusOperation>[]
    > = groupBy(data, (item) => item.flow.id);
    return super.saveData(
      // TODO: remove item.flow.name from the operation data right before saving?
      Object.values(opsGroupedByFlows).map(resolveOperationOrder).flat(),
    );
  }

  protected getSortFunction(): (
    a: WithSyncIdAndWithoutId<DirectusOperation>,
    b: WithSyncIdAndWithoutId<DirectusOperation>,
  ) => number {
    // Operations are sorted respecting their connection graph,
    // so we don't need to sort them here
    return () => 0;
  }
}
