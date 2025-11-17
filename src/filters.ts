/**
 * Filter builder utilities for metadata and document filtering
 *
 * Supports:
 * - Metadata filters: $eq, $lt, $gt, $lte, $gte, $ne, $in, $nin
 * - Logical operators: $or, $and, $not
 * - Document filters: $contains, $regex
 */

import type { Where, WhereDocument } from './types.js';

/**
 * Result of building a filter
 * Returns SQL WHERE clause and parameters for parameterized queries
 */
export interface FilterResult {
  clause: string;
  params: unknown[];
}

/**
 * Filter condition for hybrid search
 */
export interface SearchFilterCondition {
  term?: Record<string, { value: any }>;
  range?: Record<string, Record<string, any>>;
  bool?: {
    must?: SearchFilterCondition[];
    should?: SearchFilterCondition[];
    must_not?: SearchFilterCondition[];
  };
}

/**
 * FilterBuilder class for building SQL WHERE clauses from filter dictionaries
 */
export class FilterBuilder {
  // Comparison operators mapping
  private static readonly COMPARISON_OPS: Record<string, string> = {
    $eq: '=',
    $lt: '<',
    $gt: '>',
    $lte: '<=',
    $gte: '>=',
    $ne: '!=',
  };

  // Logical operators
  private static readonly LOGICAL_OPS = ['$and', '$or', '$not'];

  /**
   * Build WHERE clause for metadata filtering
   *
   * @param where - Filter dictionary with operators
   * @param metadataColumn - Name of metadata column (default: "metadata")
   * @returns FilterResult with SQL clause and parameters
   *
   * @example
   * where = {age: {$gte: 18}}
   * -> {clause: "JSON_EXTRACT(metadata, '$.age') >= ?", params: [18]}
   *
   * where = {$and: [{age: {$gte: 18}}, {city: "Beijing"}]}
   * -> {clause: "(JSON_EXTRACT(metadata, '$.age') >= ? AND JSON_EXTRACT(metadata, '$.city') = ?)", params: [18, "Beijing"]}
   */
  static buildMetadataFilter(
    where?: Where,
    metadataColumn: string = 'metadata'
  ): FilterResult {
    if (!where) {
      return { clause: '', params: [] };
    }

    return this._buildCondition(where, metadataColumn, []);
  }

  /**
   * Build WHERE clause for document filtering
   *
   * @param whereDocument - Filter dictionary with $contains, $regex, $and, $or operators
   * @param documentColumn - Name of document column (default: "document")
   * @returns FilterResult with SQL clause and parameters
   *
   * @example
   * whereDocument = {$contains: "python"}
   * -> {clause: "MATCH(document) AGAINST (? IN NATURAL LANGUAGE MODE)", params: ["python"]}
   *
   * whereDocument = {$regex: "^hello.*world$"}
   * -> {clause: "document REGEXP ?", params: ["^hello.*world$"]}
   */
  static buildDocumentFilter(
    whereDocument?: WhereDocument,
    documentColumn: string = 'document'
  ): FilterResult {
    if (!whereDocument) {
      return { clause: '', params: [] };
    }

    return this._buildDocumentCondition(whereDocument, documentColumn, []);
  }

  /**
   * Recursively build condition from nested dictionary
   */
  private static _buildCondition(
    condition: Where,
    metadataColumn: string,
    params: unknown[]
  ): FilterResult {
    const clauses: string[] = [];

    for (const [key, value] of Object.entries(condition)) {
      if (this.LOGICAL_OPS.includes(key)) {
        // Handle logical operators
        if (key === '$and' && Array.isArray(value)) {
          const subClauses: string[] = [];
          for (const subCondition of value) {
            const result = this._buildCondition(subCondition, metadataColumn, params);
            subClauses.push(result.clause);
          }
          clauses.push(`(${subClauses.join(' AND ')})`);
        } else if (key === '$or' && Array.isArray(value)) {
          const subClauses: string[] = [];
          for (const subCondition of value) {
            const result = this._buildCondition(subCondition, metadataColumn, params);
            subClauses.push(result.clause);
          }
          clauses.push(`(${subClauses.join(' OR ')})`);
        } else if (key === '$not') {
          const result = this._buildCondition(value as Where, metadataColumn, params);
          clauses.push(`NOT (${result.clause})`);
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle comparison operators
        for (const [op, opValue] of Object.entries(value)) {
          if (op in this.COMPARISON_OPS) {
            const sqlOp = this.COMPARISON_OPS[op];
            clauses.push(`JSON_EXTRACT(${metadataColumn}, '$.${key}') ${sqlOp} ?`);
            params.push(opValue);
          } else if (op === '$in' && Array.isArray(opValue)) {
            const placeholders = opValue.map(() => '?').join(', ');
            clauses.push(`JSON_EXTRACT(${metadataColumn}, '$.${key}') IN (${placeholders})`);
            params.push(...opValue);
          } else if (op === '$nin' && Array.isArray(opValue)) {
            const placeholders = opValue.map(() => '?').join(', ');
            clauses.push(`JSON_EXTRACT(${metadataColumn}, '$.${key}') NOT IN (${placeholders})`);
            params.push(...opValue);
          }
        }
      } else {
        // Direct equality comparison
        clauses.push(`JSON_EXTRACT(${metadataColumn}, '$.${key}') = ?`);
        params.push(value);
      }
    }

    const clause = clauses.length > 0 ? clauses.join(' AND ') : '1=1';
    return { clause, params };
  }

  /**
   * Build document filter condition
   */
  private static _buildDocumentCondition(
    condition: WhereDocument,
    documentColumn: string,
    params: unknown[]
  ): FilterResult {
    const clauses: string[] = [];

    for (const [key, value] of Object.entries(condition)) {
      if (key === '$contains') {
        // Full-text search using MATCH AGAINST
        clauses.push(`MATCH(${documentColumn}) AGAINST (? IN NATURAL LANGUAGE MODE)`);
        params.push(value);
      } else if (key === '$regex') {
        // Regular expression matching
        clauses.push(`${documentColumn} REGEXP ?`);
        params.push(value);
      } else if (key === '$and' && Array.isArray(value)) {
        const subClauses: string[] = [];
        for (const subCondition of value) {
          const result = this._buildDocumentCondition(subCondition, documentColumn, params);
          subClauses.push(result.clause);
        }
        clauses.push(`(${subClauses.join(' AND ')})`);
      } else if (key === '$or' && Array.isArray(value)) {
        const subClauses: string[] = [];
        for (const subCondition of value) {
          const result = this._buildDocumentCondition(subCondition, documentColumn, params);
          subClauses.push(result.clause);
        }
        clauses.push(`(${subClauses.join(' OR ')})`);
      }
    }

    const clause = clauses.length > 0 ? clauses.join(' AND ') : '1=1';
    return { clause, params };
  }

  /**
   * Combine metadata and document filters
   *
   * @param metadataFilter - Metadata filter result
   * @param documentFilter - Document filter result
   * @returns Combined FilterResult
   */
  static combineFilters(
    metadataFilter: FilterResult,
    documentFilter: FilterResult
  ): FilterResult {
    const clauses: string[] = [];
    const allParams: unknown[] = [];

    if (metadataFilter.clause) {
      clauses.push(metadataFilter.clause);
      allParams.push(...metadataFilter.params);
    }

    if (documentFilter.clause) {
      clauses.push(documentFilter.clause);
      allParams.push(...documentFilter.params);
    }

    if (clauses.length > 0) {
      return {
        clause: clauses.join(' AND '),
        params: allParams,
      };
    } else {
      return { clause: '', params: [] };
    }
  }

  /**
   * Build search_params filter format from where condition for hybrid search
   *
   * @param where - Filter dictionary with operators
   * @returns List of filter conditions in search_params format, or null if where is empty
   *
   * @example
   * where = {category: {$eq: "science"}}
   * -> [{"term": {"metadata.category": {"value": "science"}}}]
   *
   * where = {$and: [{page: {$gte: 5}}, {page: {$lte: 10}}]}
   * -> [{"bool": {"must": [{"range": {"metadata.page": {"gte": 5}}}, {"range": {"metadata.page": {"lte": 10}}}]}}]
   */
  static buildSearchFilter(where?: Where): SearchFilterCondition[] | null {
    if (!where) {
      return null;
    }

    const filterCondition = this._buildSearchFilterCondition(where);
    if (filterCondition) {
      return [filterCondition];
    }
    return null;
  }

  /**
   * Recursively build search_params filter condition from nested dictionary
   */
  private static _buildSearchFilterCondition(
    condition: Where
  ): SearchFilterCondition | null {
    if (!condition) {
      return null;
    }

    // Handle logical operators
    if ('$and' in condition && Array.isArray(condition.$and)) {
      const mustConditions: SearchFilterCondition[] = [];
      for (const subCondition of condition.$and) {
        const subFilter = this._buildSearchFilterCondition(subCondition as Where);
        if (subFilter) {
          mustConditions.push(subFilter);
        }
      }
      if (mustConditions.length > 0) {
        return { bool: { must: mustConditions } };
      }
      return null;
    }

    if ('$or' in condition && Array.isArray(condition.$or)) {
      const shouldConditions: SearchFilterCondition[] = [];
      for (const subCondition of condition.$or) {
        const subFilter = this._buildSearchFilterCondition(subCondition as Where);
        if (subFilter) {
          shouldConditions.push(subFilter);
        }
      }
      if (shouldConditions.length > 0) {
        return { bool: { should: shouldConditions } };
      }
      return null;
    }

    if ('$not' in condition) {
      const notFilter = this._buildSearchFilterCondition(condition.$not as Where);
      if (notFilter) {
        return { bool: { must_not: [notFilter] } };
      }
      return null;
    }

    // Handle field conditions
    const result: SearchFilterCondition = {
      bool: {
        must: [],
        should: [],
        must_not: [],
      },
    };
    let hasConditions = false;

    for (const [key, value] of Object.entries(condition)) {
      if (this.LOGICAL_OPS.includes(key)) {
        continue;
      }

      const fieldName = `metadata.${key}`;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle comparison operators
        const rangeConditions: Record<string, any> = {};
        const termConditions: SearchFilterCondition[] = [];
        const inConditions: SearchFilterCondition[] = [];
        const ninConditions: SearchFilterCondition[] = [];

        for (const [op, opValue] of Object.entries(value)) {
          if (op === '$eq') {
            termConditions.push({ term: { [fieldName]: { value: opValue } } });
            hasConditions = true;
          } else if (op === '$ne') {
            result.bool!.must_not!.push({ term: { [fieldName]: { value: opValue } } });
            hasConditions = true;
          } else if (op === '$lt') {
            rangeConditions.lt = opValue;
            hasConditions = true;
          } else if (op === '$lte') {
            rangeConditions.lte = opValue;
            hasConditions = true;
          } else if (op === '$gt') {
            rangeConditions.gt = opValue;
            hasConditions = true;
          } else if (op === '$gte') {
            rangeConditions.gte = opValue;
            hasConditions = true;
          } else if (op === '$in' && Array.isArray(opValue)) {
            for (const val of opValue) {
              inConditions.push({ term: { [fieldName]: { value: val } } });
            }
            hasConditions = true;
          } else if (op === '$nin' && Array.isArray(opValue)) {
            for (const val of opValue) {
              ninConditions.push({ term: { [fieldName]: { value: val } } });
            }
            hasConditions = true;
          }
        }

        if (Object.keys(rangeConditions).length > 0) {
          result.bool!.must!.push({ range: { [fieldName]: rangeConditions } });
        }
        if (termConditions.length > 0) {
          result.bool!.must!.push(...termConditions);
        }
        if (inConditions.length > 0) {
          result.bool!.should!.push(...inConditions);
        }
        if (ninConditions.length > 0) {
          result.bool!.must_not!.push(...ninConditions);
        }
      } else {
        // Direct equality
        result.bool!.must!.push({ term: { [fieldName]: { value } } });
        hasConditions = true;
      }
    }

    if (!hasConditions) {
      return null;
    }

    // Clean up empty arrays
    if (result.bool!.must!.length === 0) {
      delete result.bool!.must;
    }
    if (result.bool!.should!.length === 0) {
      delete result.bool!.should;
    }
    if (result.bool!.must_not!.length === 0) {
      delete result.bool!.must_not;
    }

    // If only one type of condition, simplify
    const boolKeys = Object.keys(result.bool!);
    if (boolKeys.length === 1) {
      const key = boolKeys[0] as 'must' | 'should' | 'must_not';
      const conditions = result.bool![key]!;
      if (conditions.length === 1) {
        return conditions[0];
      }
      return { bool: { [key]: conditions } };
    }

    return result;
  }
}
