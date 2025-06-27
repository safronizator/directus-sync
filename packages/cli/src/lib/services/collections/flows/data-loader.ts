import { WithSyncIdAndWithoutId } from '../base';
import { Service } from 'typedi';
import { FLOWS_COLLECTION } from './constants';
import path from 'path';
import { DirectusFlow } from './interfaces';
import { ConfigService } from '../../config';
import { MigrationClient } from '../../migration-client';
import { clearDirIfExists } from '../helpers';
import { TreeDataLoader } from '../base/data-loader-tree';

@Service()
export class FlowsDataLoader extends TreeDataLoader<DirectusFlow> {
  constructor(config: ConfigService, migrationClient: MigrationClient) {
    const filePath = path.join(
      config.getCollectionsConfig().dumpPath,
      FLOWS_COLLECTION,
    );
    const hooks = config.getCollectionHooksConfig(FLOWS_COLLECTION);
    super(
      filePath,
      migrationClient,
      hooks,
      'flow',
      (item) => `${item.name} (${item._syncId})`,
    );
  }

  /**
   * Save the data to the dump file. The data is passed through the data transformer.
   */
  async saveData(data: WithSyncIdAndWithoutId<DirectusFlow>[]) {
    clearDirIfExists(this.filePath);
    return super.saveData(data);
  }
}
