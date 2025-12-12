GET_SQL 函数用于获取实际执行的 SQL 语句，以字符串形式返回。

语法
FUNCTION GET_SQL (IN table_name VARCHAR(65535), 
                  IN search_params LONGTEXT)
RETURN LONGTEXT;
参数说明
参数	描述	是否必选
table_name	表名，支持堆表和无主键表。	必选
search_params	搜索参数，是 JSON 格式的字符串。	必选
search_params 语法结构
search_params 是 JSON 格式的字符串，其语法结构将在此节详细介绍，请配合下文参数和示例一起理解。

语法说明
本节介绍 BNF 语法符号的含义和使用规则：

可选参数表示

[ ] 在 BNF 中表示可选多个元素，如 param_list = param [, param]* 表示 param_list 可以包含 1 个或多个 param。
rank_feature、rank_expression 中 [ ] 也表示子参数可选。
[, "boost" : boost_value] 代表 boost 子参数可选，所有 boost 子参数均可选。
数组表示

[ ] 在 JSON 结构中表示数组，如 [condition_list]。
选择关系

| 表示选择关系，如 param = "query" | "knn" 表示 param 可以是 "query" 或 "knn"。
重复表示

* 表示 0 次或多次重复，如 param_list = param [, param]* 表示 param_list 可以包含 1 个或多个 param。
JSON 格式要求

所有 JSON 字段名和字符串值都需要用双引号包围。
数值不需要用双引号包围。
语法定义
本节详细介绍 search_params 的语法结构，参数说明请参考下方详细参数说明表格。

顶层参数结构
-- 顶层关键字参数
search_params = '{param_list}'
    param_list = param [, param]*
    -- query 和 knn 参数分别用于全文/标量和向量检索，至少必选一个；混合检索时同时使用
    param = "query"     : {query_expression}
          | "knn"       : {knn_expression}  
          | "rank"      : {rank_expression}
          | "_source"   : [field_list]
          | "from"      : number
          | "size"      : number
          | "es_mode"   : boolean
查询表达式结构
query_expression = bool_query | single_term

-- bool_query 语法结构
bool_query = "bool" : {bool_condition_list}
    bool_condition_list = bool_condition [, bool_condition]*
    -- boost 子参数可选
    bool_condition = "must"    : [condition_list]
                  | "should"   : [condition_list]
                  | "must_not" : [condition_list]
                  | "filter"   : [condition_list]
                  | "boost"    : boost_value
    -- 支持嵌套 bool_query
    condition_list = query_expression [, query_expression]*
单个词条查询结构
single_term = range_query | match_query | term_query | query_string | multi_match | rank_feature

-- range_query 语法结构
range_query = "range" : {"field_name" : {range_condition_list}}
    range_condition_list = range_condition [, range_condition]*
    -- boost 子参数可选
    range_condition = "gte"    : number
                    | "gt"     : number
                    | "lte"    : number
                    | "lt"     : number
                    | "boost"  : boost_value

-- match_query 语法结构
match_query = "match" : {"field_name" : {match_condition}}
    -- boost 子参数可选
    match_condition = "query" : "string_value" [, "boost" : boost_value]

-- term_query 语法结构
term_query = "term" : {term_condition_list}
    term_condition_list = term_condition [, term_condition]*
    term_condition = "field_name" : scalar_value
                   | "field_name" : term_value_object
    -- boost 子参数可选
    term_value_object = "value" : scalar_value [, "boost" : boost_value]

-- 全文搜索表达式结构，包含 query_string 和 multi_match 两种检索方式
query_string = "query_string" : {query_string_condition}
-- fields 和 query 子参数必选
    query_string_condition = "fields" : [field_weight_list]
                           | "query"  : "string_value"
                           | "boost"  : boost_value
                           | "type"   : ("best_fields" | "cross_fields" | "most_fields" | "phrase")
                           | "default_operator" : ("AND" | "OR")
                           | "minimum_should_match" : number
    field_weight_list = field_weight [, field_weight]*
    -- field_name、^、number 之间不能有空格
    field_weight = "field_name[^number]"

-- multi_match 语法结构，从 V4.4.1 BP0 HotFix1 版本开始支持
multi_match = "multi_match" : {multi_match_condition}
-- fields 和 query 子参数必选
    multi_match_condition = "fields" : [field_weight_list]
                         | "query"  : "string_value"
                         | "boost"  : boost_value
                         | "type"   : ("best_fields" | "cross_fields" | "most_fields" | "phrase")
                         | "operator" : ("AND" | "OR")
                         | "minimum_should_match" : number
    field_weight_list = field_weight [, field_weight]*
    -- field_name、^、number 之间不能有空格
    field_weight = "field_name[^number]"

-- 特征排序表达式结构
rank_feature = "rank_feature" : {"field_name" : {rank_algorithm}}
    rank_algorithm = "saturation" : {"pivot" : number[, "positive_score_impact" : boolean]}
                   | "sigmoid"    : {"pivot" : number, "exponent" : number[, "positive_score_impact" : boolean]}
                   | "log"        : {"scaling_factor" : number[, "positive_score_impact" : boolean]}
                   | "linear"     : {["positive_score_impact" : boolean]}
向量检索表达式结构
-- knn_expression 语法结构
knn_expression = "knn" : {knn_condition_list}
    knn_condition_list = knn_condition [, knn_condition]*
    -- field，k，query_vector 子参数必选
    knn_condition = "field"         : "field_name"
                 | "k"             : number
                 | "query_vector"  : [vector_values]
                 | "filter"        : [condition_list]
                 | "similarity"    : number
                 | "boost"         : boost_value
    vector_values = float [, float]*
    condition_list = {condition [, condition]*}
    condition = single_term

-- rank_expression 语法结构，RRF 从 V4.4.1 BP0 HotFix1 版本开始支持
rank_expression = "rank" : {rank_strategy}
    rank_strategy = "rrf" : {rrf_params}
    rrf_params = "rank_window_size" : number [, "rank_constant" : number]
基础类型定义
-- 基础类型定义
field_name = "string_value"
field_list = field_name [, field_name]*
number = integer | decimal
boost_value = integer | float  -- boost 参数值必须 >= 0
boolean = true | false
scalar_value = "string_value" | number | boolean
详细参数说明
search_params 的详细参数说明如下：

表达式类型	参数名称	参数描述
顶层关键字参数
query	进行全文搜索时可单独使用，混合检索时可以与 knn 参数同时使用。
knn	进行向量检索时可单独使用，混合检索时可以与 query 参数同时使用。
rank（可选）	用于指定混合检索时的排序策略，支持 RRF（Reciprocal Rank Fusion）算法。
注意
该参数从 V4.4.1 BP0 HotFix1 版本开始支持。

_source（可选）	用于指定检索需要返回的列，不指定则返回表上全部用户定义的列。
from（可选）	用于指定从检索结果集的第几行返回结果，不指定则默认从第 1 行返回，需要和 size 参数一起使用。
size（可选）	用于限制返回结果的函数，不指定则不限制。
es_mode	用于指定是否将全文搜索转成 ESQL 新语法，默认 false。
bool	must	必须满足，需要计算得分。在内部需要布尔逻辑时，须嵌套 bool 表达式，bool 表达式中的多个条件默认按 AND 逻辑组合。
should	应该满足，类似于 OR，需要计算得分。在内部需要布尔逻辑时，须嵌套 bool 表达式，bool 表达式中的多个条件默认按 AND 逻辑组合。
must_not	必须不满足，不计算得分，转换成 'NOT' 表达式，must_not 内多个以 'AND' 相连。在内部需要布尔逻辑时，须嵌套 bool 表达式，bool 表达式中的多个条件默认按 AND 逻辑组合。
filter	必须满足，不计算得分，转换成 'AND' 表达式。在内部需要布尔逻辑时，须嵌套 bool 表达式，bool 表达式中的多个条件默认按 AND 逻辑组合。
boost（可选）	查询权重，详见下方 boost 参数详细说明。
rank_feature（相关分数计算参数）	pivot	saturation、sigmoid 必选的算分参数，默认值为该列表上数据的几何平均值
positive_score_impact（可选）	用于设置字段对最终相关性的影响是正相关还是负相关。
scaling_factor	log 算分计算公式的必选参数。
exponent	sigmoid 算法计算公式的必选参数。
rank_feature（相关分数算法）	saturation	默认相关分算法
正相关：`S / (S + pivot)`
负相关：`pivot / (S + pivot)`
S 为该 rank_feature 列的取值
sigmoid	
与 saturation 类似，多了指数参数，检索时需要指定 e
S^e / (S^e + pivot^e)
log	
只支持正相关
计算公式 ln(scaling_factor + S)
S 为该 rank_feature 列的取值
scaling_factor 需要检索时指定
linear	
正相关得分就是 S
负相关得分是 1/S
S 为该 rank_feature 列的取值
single term（单个词条检索）
range	范围检索，搭配 gte、gt、lte、lt、boost 使用。fieldname 必选。
match	模糊匹配，转换成 sql 的 'match' 表达式，搭配 boost 使用。
term	精准匹配，支持字符串、数字、布尔值等标量值，转换成 sql 的 '=' 表达式，搭配 boost 使用。
query_string	全文匹配，转换成 sql 的多个 'match' 表达式的组合。
multi_match	全文匹配，转换成 sql 的多个 'match' 表达式的组合，和 query_string 类似，单关键词不支持权重。
注意
该参数从 V4.4.1 BP0 HotFix1 版本开始支持。

fields	文本检索字段列表，可配置每一列的权重。
query	检索关键词列表，可以配置每个关键词的权重。
minimum_should_match（可选）	用于控制 should、query_string 中需要满足的条件个数。不写该参数时，默认值为 1。注意：如果 bool 表达式中存在 must/filter，且不写该参数时，默认值会为 0，即可以不满足 should 的任意情况。
boost（可选）	查询权重，详见下方 boost 参数详细说明。
type（可选）	指定匹配模式，本期支持 best_fiedls、cross_fields、most_fields、phrase，不指定时默认 best_fields。
default_operator（可选）	query_string 的子字段，指定多个关键词之间的组合逻辑。
operator（可选）	multi_match 的子字段，指定多个关键词之间的组合逻辑。
knn（向量检索）
field	向量检索字段。
k	执行向量检索返回行数。
query_vector	指定检索向量。
filter（可选）	过滤条件。
similarity（可选）	用于指定向量距离的过滤条件。
boost（可选）	查询权重，详见下方 boost 参数详细说明。
rank（RRF 排序策略）	rrf	RRF（Reciprocal Rank Fusion）排序策略，用于混合检索时对多个查询结果进行融合排序。
注意
该参数从 V4.4.1 BP0 HotFix1 版本开始支持。

rank_window_size（可选）	该值用于指定每个查询所返回的单个结果集的大小。值越大，结果的相关性越高，但会带来性能开销。最终的排序结果集会被裁剪至搜索请求中指定的 size 大小。

rank_window_size 必须同时满足：
大于或等于 size 参数
大于或等于 1
默认值为 size 参数的值。
rank_constant（可选）	该值用于控制每个查询所返回的单个结果集中各文档对最终排序结果的影响程度。值越大，表示排名靠后的文档对最终结果的影响越大。默认值为 60。
boost 参数详细说明
boost 参数用于指定查询条件在最终相关性计算中的权重，值必须 ≥ 0，不指定时默认为 1。上述语法结构中，bool、single_term（除 rank_feature 外）、knn 都支持指定 boost 参数。每种检索类型支持的 boost 参数使用方式如下：

查询级别 boost

对整个查询条件指定权重，例如：

{
  "bool": {
    "must": [{"term": {"category": "Gaming"}}],
    "boost": 2.0  // 整个 bool 查询的权重
  }
}
字段级别 boost

对特定字段的查询指定权重：

{
  "query_string": {
    "fields": ["product_name", "description"],
    "query": "gaming keyboard",
    "boost": 1.5  // 整个 query_string 查询的权重
  }
}
匹配值级别 boost

对具体的匹配值指定权重（仅 match 和 term 查询支持）：

{
  "match" : {
    "product_name":  {
    "query" : "gaming keyboard",
    "boost" : 1.5
    }
  }
}
字段权重语法

在 query_string 和 multi_match 中，可以使用 field_name^weight 语法：

{
  "query_string": {
    "fields": ["product_name^2.0", "description^1.0"],
    "query": "gaming"
  }
}
示例
建表包含1个向量列，对其创建向量索引，2个 varchar 列，分别对齐创建全文索引。

CREATE TABLE doc_table(c1 INT, vector VECTOR(3), query VARCHAR(255), content VARCHAR(255), 
VECTOR INDEX idx1(vector) WITH (distance=l2, type=hnsw, lib=vsag), FULLTEXT INDEX idx2(query), 
FULLTEXT INDEX idx3(content));
设置检索参数。

SET @parm = '{
      "query": {
        "bool": {
          "should": [
            {"match": {"query": "hi hello"}}, 
            {"match": { "content": "oceanbase mysql" }}
          ],
          "filter": [
            {"term": { "content" : "postgres" }}
          ]
        }
      },
       "knn" : {
          "field": "vector",
          "k": 5,
          "query_vector": [1,2,3]
      },
      "_source" : ["query", "content", "_keyword_score", "_semantic_score"]
    }';
执行查询并返回查询结果。

SELECT DBMS_HYBRID_SEARCH.GET_SQL('doc_table', @parm);
返回结果如下：

+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| dbms_hybrid_search.get_sql('doc_table', @parm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| SELECT query, content, _keyword_score, _semantic_score, (ifnull(_fts._keyword_score, 0) + ifnull(_vs._semantic_score, 0)) as _score FROM ((SELECT /*+ opt_param('hidden_column_visible', 'true') union_merge( doc_table idx2 idx3)*/__pk_increment, (match(query) against('hi hello' in boolean mode) + match(content) against('oceanbase mysql' in boolean mode)) as _keyword_score FROM wxj.doc_table WHERE (content = 'postgres') ORDER BY _keyword_score DESC) _fts right join (SELECT /*+ opt_param('hidden_column_visible', 'true') */l2_distance(vector, '[1, 2, 3]') as _distance, __pk_increment, query, content, round((1 / (1 + l2_distance(vector, '[1, 2, 3]'))), 8) as _semantic_score FROM wxj.doc_table ORDER BY _distance APPROXIMATE LIMIT 5) _vs on (_fts.__pk_increment = _vs.__pk_increment)) ORDER BY _score DESC |
+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+