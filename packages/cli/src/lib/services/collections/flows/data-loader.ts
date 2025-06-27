import { DataLoader, WithSyncIdAndWithoutId } from '../base';
import { Service } from 'typedi';
import { FLOWS_COLLECTION } from './constants';
import path from 'path';
import { DirectusFlow } from './interfaces';
import { ConfigService } from '../../config';
import { MigrationClient } from '../../migration-client';
import { outputJsonSync, readJsonSync } from 'fs-extra';
import { clearDirIfExists, listOnlyDirs } from '../helpers';

@Service()
export class FlowsDataLoader extends DataLoader<DirectusFlow> {
  constructor(config: ConfigService, migrationClient: MigrationClient) {
    // const filePath = path.join(
    //   config.getCollectionsConfig().dumpPath,
    //   `${FLOWS_COLLECTION}.json`,
    // );
    const filePath = path.join(
      config.getCollectionsConfig().dumpPath,
      FLOWS_COLLECTION,
    );
    const hooks = config.getCollectionHooksConfig(FLOWS_COLLECTION);
    super(filePath, migrationClient, hooks);
  }

  /**
   * Returns the source data from the dump file, using readFileSync
   * and passes it through the data transformer.
   */
  async getSourceData(): Promise<WithSyncIdAndWithoutId<DirectusFlow>[]> {
    const { onLoad } = this.hooks;
    // const loadedData: WithSyncIdAndWithoutId<DirectusFlow>[] =
    //   readJsonSync(this.filePath, { throws: false }) || [];

    const loadedData: WithSyncIdAndWithoutId<DirectusFlow>[] = listOnlyDirs(
      this.filePath,
    ).map((flowDir) => {
      const flowFile = path.join(this.filePath, flowDir, 'flow.json');
      return readJsonSync(flowFile, { throws: false }) || {};
    });

    return onLoad
      ? await onLoad(loadedData, await this.migrationClient.get())
      : loadedData;
  }

  /**
   * Save the data to the dump file. The data is passed through the data transformer.
   */
  async saveData(data: WithSyncIdAndWithoutId<DirectusFlow>[]) {
    // Sort data by _syncId to avoid git changes
    data.sort(this.getSortFunction());
    const { onSave } = this.hooks;
    const transformedData = onSave
      ? await onSave(data, await this.migrationClient.get())
      : data;

    clearDirIfExists(this.filePath);
    transformedData.forEach((flowData) => {
      const flowFile = path.join(
        this.filePath,
        `${flowData.name} (${flowData._syncId})`,
        'flow.json',
      );
      outputJsonSync(flowFile, flowData, { spaces: 2 });
    });

    // writeJsonSync(this.filePath, transformedData, { spaces: 2 });
  }
}
