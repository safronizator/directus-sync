import { DataLoader, DirectusBaseType, WithSyncIdAndWithoutId } from '../base';
import { Service } from 'typedi';
import path from 'path';
import { outputJsonSync, readJsonSync } from 'fs-extra';
import { groupBy, listOnlyDirs } from '../helpers';
import { CollectionHooks } from '../../config';
import { MigrationClient } from '../../migration-client';

@Service()
export abstract class TreeDataLoader<
  DirectusType extends DirectusBaseType,
> extends DataLoader<DirectusType> {
  constructor(
    filePath: string,
    migrationClient: MigrationClient,
    hooks: CollectionHooks,
    protected readonly entryKey: string,
    protected readonly pathMapFunc: (
      item: WithSyncIdAndWithoutId<DirectusType>,
    ) => string,
    protected readonly isMany = false,
  ) {
    super(filePath, migrationClient, hooks);
  }

  /**
   * Returns the source data from the set of dump files, using readFileSync
   * and passes it through the data transformer.
   */
  async getSourceData(): Promise<WithSyncIdAndWithoutId<DirectusType>[]> {
    const { onLoad } = this.hooks;
    const loadFunc = (entry: string) => {
      const fullFileName = path.join(
        this.filePath,
        entry,
        `${this.entryKey}.json`,
      );
      return readJsonSync(fullFileName, { throws: false }) || {};
    };
    const entries = listOnlyDirs(this.filePath);
    const loadedData: WithSyncIdAndWithoutId<DirectusType>[] = this.isMany
      ? entries.map(loadFunc).flat()
      : entries.map(loadFunc);
    return onLoad
      ? await onLoad(loadedData, await this.migrationClient.get())
      : loadedData;
  }

  /**
   * Save the data to the dump file. The data is passed through the data transformer.
   */
  async saveData(data: WithSyncIdAndWithoutId<DirectusType>[]) {
    // Sort data to avoid git changes
    data.sort(this.getSortFunction());
    const { onSave } = this.hooks;
    const transformedData = onSave
      ? await onSave(data, await this.migrationClient.get())
      : data;
    const dataGroupedByPath: Record<
      string,
      WithSyncIdAndWithoutId<DirectusType>[]
    > = groupBy(transformedData, this.pathMapFunc);
    Object.entries(dataGroupedByPath).forEach(([pathKey, items]) => {
      const flowFile = path.join(
        this.filePath,
        pathKey,
        `${this.entryKey}.json`,
      );
      outputJsonSync(flowFile, this.isMany ? items : items[0], { spaces: 2 });
    });
  }
}
