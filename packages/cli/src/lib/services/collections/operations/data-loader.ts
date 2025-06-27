import { DataLoader, WithSyncIdAndWithoutId } from '../base';
import { Service } from 'typedi';
import { OPERATIONS_COLLECTION } from './constants';
import path from 'path';
import { DirectusOperation, DirectusOperationWithFlow } from './interfaces';
import { ConfigService } from '../../config';
import { MigrationClient } from '../../migration-client';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import { FLOWS_COLLECTION } from '../flows';
import { listOnlyDirs } from '../helpers';


const resolveOperationOrder = (ops: WithSyncIdAndWithoutId<DirectusOperationWithFlow>[]) => {
  const res: WithSyncIdAndWithoutId<DirectusOperationWithFlow>[] = [];
  const added = new Set<string>();
  const add = (id: string) => {
    const op = ops.find(o => o._syncId === id);
    if (!op) {
      throw new Error(`Operation ${id} not found`);
    }
    if (op.reject) add(op.reject);
    if (op.resolve) add(op.resolve);
    if (added.has(id)) return;
    added.add(id);
    res.push(op);
  }
  ops.forEach(op => add(op._syncId));
  return res;
};

@Service()
export class OperationsDataLoader extends DataLoader<DirectusOperation> {
  constructor(config: ConfigService, migrationClient: MigrationClient) {
    // const filePath = path.join(
    //   config.getCollectionsConfig().dumpPath,
    //   `${OPERATIONS_COLLECTION}.json`,
    // );
    const filePath = path.join(
      config.getCollectionsConfig().dumpPath,
      FLOWS_COLLECTION,
    );
    const hooks = config.getCollectionHooksConfig(OPERATIONS_COLLECTION);
    super(filePath, migrationClient, hooks);
  }

  /**
   * Returns the source data from the dump file, using readFileSync
   * and passes it through the data transformer.
   */
  async getSourceData(): Promise<WithSyncIdAndWithoutId<DirectusOperation>[]> {
    const { onLoad } = this.hooks;

    // const loadedData: WithSyncIdAndWithoutId<DirectusOperation>[] =
    //   readJsonSync(this.filePath, { throws: false }) || [];

    const loadedData: WithSyncIdAndWithoutId<DirectusOperation>[] = [];

    const flowDirs = listOnlyDirs(this.filePath);
    for (const flowDir of flowDirs) {
      const opsFile = path.join(this.filePath, flowDir, 'operations.json');
      const flowData: WithSyncIdAndWithoutId<DirectusOperation>[] =
        readJsonSync(opsFile, { throws: false }) || [];
      loadedData.push(...flowData);
    }

    return onLoad
      ? await onLoad(loadedData, await this.migrationClient.get())
      : loadedData;
  }

  /**
   * Save the data to the dump file. The data is passed through the data transformer.
   */
  async saveData(data: WithSyncIdAndWithoutId<DirectusOperation>[]) {

    const opsGroupedByFlows: Record<string, WithSyncIdAndWithoutId<DirectusOperationWithFlow>[]> = data.reduce(
      (acc, item) => {
        const key = `${item.flow.name} (${item.flow.id})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          ...item,
          // Remove flow name because it is unnecessary when pushing
          flow: { id: item.flow.id },
        });
        return acc;
      },
      {} as Record<string, WithSyncIdAndWithoutId<DirectusOperationWithFlow>[]>,
    );

    // Sort data by _syncId to avoid git changes
    // data.sort(this.getSortFunction());

    // const { onSave } = this.hooks;
    // const transformedData = onSave
    //   ? await onSave(data, await this.migrationClient.get())
    //   : data;
    // writeJsonSync(this.filePath, transformedData, { spaces: 2 });

    for (const [flowKey, opsData] of Object.entries(opsGroupedByFlows)) {
      // Sort flow data by _syncId to avoid git changes
      const resolved = resolveOperationOrder(opsData);
      const { onSave } = this.hooks;
      const transformedData = onSave
        ? await onSave(resolved, await this.migrationClient.get())
        : resolved;

      const flowFile = path.join(
        this.filePath,
        `${flowKey}`,
        'operations.json',
      );
      writeJsonSync(flowFile, transformedData, { spaces: 2 });
    }

  }

}
