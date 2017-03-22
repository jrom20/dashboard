
//import * as $ from 'jquery';
import * as request from 'xhr-request';
import * as _ from 'lodash';
import {DataSourcePlugin, IDataSourceOptions} from '../DataSourcePlugin';
import { appInsightsUri, appId, apiKey } from './common';

interface IQueryOptions extends IDataSourceOptions {
  query: string
  mappings: (string|object)[];
}

export default class ApplicationInsightsQuery extends DataSourcePlugin {

  /**
   * @param options - Options object
   */
  constructor(options: IQueryOptions) {
    super('ApplicationInsights-Query', 'values', options);

    var props = this._props;
    var params: any = props.params;
    if (!params.query) {
      throw new Error('AIAnalyticsEvents requires a query to run and dependencies that trigger updates.');
    }

    if (!props.dependencies.queryTimespan) {
      throw new Error('AIAnalyticsEvents requires dependencies: timespan; queryTimespan');
    }
  }

  /**
   * update - called when dependencies are created
   * @param {object} dependencies
   * @param {function} callback
   */
  updateDependencies(dependencies) {

    var emptyDependency = _.find(_.keys(this._props.dependencies), dependencyKey => {
      return typeof dependencies[dependencyKey] === 'undefined';
    });

    if (emptyDependency) {
      return (dispatch) => {
        return dispatch();
      };
    }

    var { queryTimespan } = dependencies;

    var params: any = this._props.params;
    var query = typeof params.query === 'function' ? params.query(dependencies) : params.query;
    var mappings = params.mappings;
    var queryspan = queryTimespan;
    var url = `${appInsightsUri}/${appId}/query?timespan=${queryspan}&query=${encodeURIComponent(query)}`;

    return (dispatch) => {

      request(url, {
          method: "GET",
          json: true,
          headers: {
            "x-api-key": apiKey
          }
        }, (error, json) => {

          if (error) {
            return this.failure(error);
          }
          
          var resultRows = json.Tables[0].Rows;
          if (!mappings || mappings.length === 0) {
            return dispatch({ values: resultRows });
          }

          var rows = resultRows.map(row => {
            var item = {};
            mappings.forEach((mapping, index) => {
              var key = typeof mapping === 'string' ? mapping : mapping.key;
              var idx = mapping.idx ? mapping.idx : index;
              var def = mapping.def ? mapping.def : null;
              item[key] = (mapping.val && row[idx] && mapping.val(row[index])) || row[idx] || def;
            });
            return item;
          });

          return dispatch({ values: rows });          
        });
    }
  }

}