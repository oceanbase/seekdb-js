/*
 * SeekDB Node.js N-API bindings.
 */
#define NODE_ADDON_API_DISABLE_DEPRECATED
#define NODE_ADDON_API_REQUIRE_BASIC_FINALIZERS
#define NODE_API_NO_EXTERNAL_BUFFERS_ALLOWED
#include "napi.h"

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <vector>
#include <thread>
#include <algorithm>
#include <climits>

#include "seekdb.h"

#define DEFAULT_SEEKDB_API "js-bindings"

// Type tags for external objects
static const napi_type_tag DatabaseTypeTag = { 0x1234567890123456ULL, 0x7890123456789012ULL };
static const napi_type_tag ConnectionTypeTag = { 0x2345678901234567ULL, 0x8901234567890123ULL };
static const napi_type_tag ResultTypeTag = { 0x4567890123456789ULL, 0x0123456789012345ULL };

// Database wrapper - just a marker, actual state is global in seekdb
struct SeekdbDatabase {
  std::string db_dir;
  
  SeekdbDatabase(const std::string& dir) : db_dir(dir) {}
  ~SeekdbDatabase() {
    // Database is closed globally via seekdb_close()
  }
};

// Connection wrapper
struct SeekdbConnection {
  SeekdbHandle handle;
  std::string db_name;
  bool autocommit;
  
  SeekdbConnection(SeekdbHandle h, const std::string& name, bool ac)
    : handle(h), db_name(name), autocommit(ac) {}
  
  ~SeekdbConnection() {
    if (handle) {
      seekdb_connect_close(handle);
      handle = nullptr;
    }
  }
};

// Result wrapper
struct SeekdbResultWrapper {
  SeekdbResult result;
  int64_t row_count;
  int32_t column_count;
  std::vector<std::string> column_names;
  std::vector<SeekdbField*> field_info;  // Field type information for optimized type detection
  int current_row;
  char** allocated_names;  // For seekdb_result_get_all_column_names_alloc()
  
  SeekdbResultWrapper(SeekdbResult r) 
    : result(r), row_count(0), column_count(0), current_row(-1), allocated_names(nullptr) {
    if (result) {
      // Use new API: seekdb_num_rows and seekdb_num_fields
      row_count = static_cast<int64_t>(seekdb_num_rows(result));
      int64_t raw_column_count = static_cast<int64_t>(seekdb_num_fields(result));
      
      // Handle column_count: -1 means no result set (DML), treat as 0
      // 0 means DML statement (INSERT/UPDATE/DELETE), which is normal
      // > 0 means SELECT statement with columns
      // Reference implementation treats -1 as 0 for DML statements
      if (raw_column_count < 0) {
        column_count = 0;  // Treat -1 as 0 for DML statements
      } else if (raw_column_count > INT32_MAX) {
        column_count = 0;  // Invalid column count, treat as 0
      } else {
        column_count = static_cast<int32_t>(raw_column_count);
      }
      
      // Get field information for optimized type detection
      if (column_count > 0) {
        SeekdbField* fields = seekdb_fetch_fields(result);
        if (fields) {
          for (int32_t i = 0; i < column_count; i++) {
            field_info.push_back(&fields[i]);
          }
        }
      }
      
        if (column_count > 0) {
          char** names = nullptr;
          int32_t actual_count = column_count;
          int ret = seekdb_result_get_all_column_names_alloc(result, &names, &actual_count);
          if (ret == SEEKDB_SUCCESS && names && actual_count == column_count) {
            allocated_names = names;
            for (int32_t i = 0; i < column_count; i++) {
              if (names[i]) {
                column_names.push_back(std::string(names[i]));
              } else {
                column_names.push_back("col_" + std::to_string(i));
              }
            }
          } else {
          // Fallback: get column names one by one (similar to reference implementation)
          for (int32_t i = 0; i < column_count; i++) {
            // Use fixed-size buffer like reference implementation (256 bytes)
            std::vector<char> name_buf(256, 0);
            int ret = seekdb_result_column_name(result, i, name_buf.data(), name_buf.size());
            if (ret == SEEKDB_SUCCESS) {
              size_t actual_len = strlen(name_buf.data());
              if (actual_len > 0) {
                column_names.push_back(std::string(name_buf.data(), actual_len));
                continue;
              }
            }
            
            // Fallback: try with name_len first (for longer names)
            size_t name_len = seekdb_result_column_name_len(result, i);
            if (name_len != static_cast<size_t>(-1) && name_len > 0 && name_len < 1024) {
              std::vector<char> len_buf(name_len + 1, 0);
              if (seekdb_result_column_name(result, i, len_buf.data(), len_buf.size()) == SEEKDB_SUCCESS) {
                column_names.push_back(std::string(len_buf.data()));
                continue;
              }
            }
            
            // Last resort: use default name (similar to reference implementation)
            char default_name[64];
            snprintf(default_name, sizeof(default_name), "col_%d", i);
            column_names.push_back(std::string(default_name));
          }
        }
      }
    }
  }
  
  ~SeekdbResultWrapper() {
    // Allocated names: caller must free
    if (allocated_names && column_count > 0) {
      seekdb_free_column_names(allocated_names, column_count);
      allocated_names = nullptr;
    }
    // field_info: pointers into result set; valid until seekdb_result_free(result), do not free
    if (result) {
      seekdb_result_free(result);
      result = nullptr;
    }
  }
};

// Helper functions to get objects from external
template<typename T>
T* GetFromExternal(Napi::Env env, Napi::Value value, const napi_type_tag& type_tag) {
  if (!value.IsExternal()) {
    throw Napi::TypeError::New(env, "Expected external object");
  }
  auto external = value.As<Napi::External<T>>();
  if (!external.CheckTypeTag(&type_tag)) {
    throw Napi::TypeError::New(env, "Invalid type tag");
  }
  return external.Data();
}

SeekdbDatabase* GetDatabaseFromExternal(Napi::Env env, Napi::Value value) {
  return GetFromExternal<SeekdbDatabase>(env, value, DatabaseTypeTag);
}

SeekdbConnection* GetConnectionFromExternal(Napi::Env env, Napi::Value value) {
  return GetFromExternal<SeekdbConnection>(env, value, ConnectionTypeTag);
}

SeekdbResultWrapper* GetResultFromExternal(Napi::Env env, Napi::Value value) {
  return GetFromExternal<SeekdbResultWrapper>(env, value, ResultTypeTag);
}

// Create external objects
template<typename T>
Napi::External<T> CreateExternal(Napi::Env env, const napi_type_tag& type_tag, T* data) {
  auto external = Napi::External<T>::New(env, data, [](Napi::Env, T* data) {
    delete data;
  });
  external.TypeTag(&type_tag);
  return external;
}

// Returns which parameter indices (0-based) correspond to CAST(? AS BINARY) (_id) placeholders.
// C ABI expects SEEKDB_TYPE_VARBINARY_ID for those so it can right-pad/truncate to 512 bytes.
static std::vector<bool> get_varbinary_id_param_indices(const std::string& sql, uint32_t param_count) {
  std::vector<bool> result(param_count, false);
  uint32_t param_index = 0;
  const size_t sql_len = sql.size();
  for (size_t pos = 0; pos < sql_len && param_index < param_count; ++pos) {
    if (sql[pos] == '?') {
      if (pos >= 5 && pos + 12 <= sql_len &&
          sql.compare(pos - 5, 5, "CAST(") == 0 &&
          sql.compare(pos + 1, 11, " AS BINARY)") == 0) {
        result[param_index] = true;
      }
      ++param_index;
    }
  }
  return result;
}

// Async worker for execute operation
class ExecuteWorker : public Napi::AsyncWorker {
 public:
  ExecuteWorker(Napi::Promise::Deferred deferred, SeekdbConnection* conn, const std::string& sql)
    : Napi::AsyncWorker(deferred.Env()), deferred_(deferred), conn_(conn), sql_(sql), 
      has_params_(false), param_count_(0), result_(nullptr) {}
  
  ExecuteWorker(Napi::Promise::Deferred deferred, SeekdbConnection* conn, const std::string& sql, 
                const Napi::Array& params)
    : Napi::AsyncWorker(deferred.Env()), deferred_(deferred), conn_(conn), sql_(sql),
      has_params_(true), result_(nullptr) {
    // Extract parameter values in constructor (main thread) before Execute() runs
    // This is safe because constructor runs on main thread
    Napi::Env env = deferred.Env();
    Napi::HandleScope scope(env);
    
    param_count_ = params.Length();
    if (param_count_ > 0) {
      param_types_.reserve(param_count_);
      param_strings_.reserve(param_count_);
      param_numbers_.reserve(param_count_);
      param_bools_.reserve(param_count_);
      
      for (uint32_t i = 0; i < param_count_; i++) {
        Napi::Value param = params.Get(i);
        
        if (param.IsNull() || param.IsUndefined()) {
          param_types_.push_back(SEEKDB_TYPE_NULL);
          param_strings_.push_back("");
          param_numbers_.push_back(0);
          param_bools_.push_back(false);
        } else if (param.IsString()) {
          param_types_.push_back(SEEKDB_TYPE_STRING);
          param_strings_.push_back(param.As<Napi::String>().Utf8Value());
          param_numbers_.push_back(0);
          param_bools_.push_back(false);
        } else if (param.IsNumber()) {
          double num_val = param.As<Napi::Number>().DoubleValue();
          param_numbers_.push_back(num_val);
          // Check if it's an integer
          if (num_val == static_cast<int64_t>(num_val)) {
            param_types_.push_back(SEEKDB_TYPE_LONGLONG);
          } else {
            param_types_.push_back(SEEKDB_TYPE_DOUBLE);
          }
          param_strings_.push_back("");
          param_bools_.push_back(false);
        } else if (param.IsBoolean()) {
          param_types_.push_back(SEEKDB_TYPE_TINY);
          param_bools_.push_back(param.As<Napi::Boolean>().Value());
          param_strings_.push_back("");
          param_numbers_.push_back(0);
        } else {
          // Convert to string
          param_types_.push_back(SEEKDB_TYPE_STRING);
          param_strings_.push_back(param.ToString().Utf8Value());
          param_numbers_.push_back(0);
          param_bools_.push_back(false);
        }
      }
    }
  }

  ~ExecuteWorker() {
    if (result_) {
      delete result_;
    }
  }

 protected:
  void Execute() override {
    SeekdbResult seekdb_result = nullptr;
    int ret;

    if (has_params_ && param_count_ > 0) {
      // Which parameters are _id (CAST(? AS BINARY)) - C ABI uses SEEKDB_TYPE_VARBINARY_ID for 512-byte padding
      std::vector<bool> varbinary_id_flags = get_varbinary_id_param_indices(sql_, param_count_);

      // Build SeekdbBind array from pre-extracted parameter values
      // This is safe because we're only using C++ types, no NAPI objects
      std::vector<SeekdbBind> binds;
      std::vector<std::vector<char>> string_buffers;  // Keep string buffers alive
      std::vector<unsigned long> lengths;
      // Use uint8_t instead of bool for null_flags (std::vector<bool> is specialized and can't take address)
      std::vector<uint8_t> null_flags;
      std::vector<int64_t> int_values;
      std::vector<double> double_values;
      // Use uint8_t instead of bool for bool_values (std::vector<bool> is specialized and can't take address)
      std::vector<uint8_t> bool_values;
      
      for (uint32_t i = 0; i < param_count_; i++) {
        SeekdbBind bind = {};
        SeekdbFieldType param_type = param_types_[i];
        if (param_type == SEEKDB_TYPE_NULL) {
          null_flags.push_back(1);  // true
          bind.buffer_type = SEEKDB_TYPE_NULL;
          bind.is_null = reinterpret_cast<bool*>(&null_flags.back());
        } else if (param_type == SEEKDB_TYPE_STRING) {
          const std::string& str_val = param_strings_[i];
          
          // _id placeholders (CAST(? AS BINARY)) use VARBINARY_ID so C ABI right-pads to 512 bytes
          SeekdbFieldType bind_type = (i < varbinary_id_flags.size() && varbinary_id_flags[i])
              ? SEEKDB_TYPE_VARBINARY_ID
              : SEEKDB_TYPE_STRING;
          string_buffers.push_back(std::vector<char>(str_val.begin(), str_val.end()));
          string_buffers.back().push_back('\0');
          
          lengths.push_back(str_val.length());
          null_flags.push_back(0);  // false
          bind.buffer_type = bind_type;
          bind.buffer = string_buffers.back().data();
          bind.buffer_length = str_val.length();
          bind.length = &lengths.back();
          bind.is_null = reinterpret_cast<bool*>(&null_flags.back());
        } else if (param_type == SEEKDB_TYPE_LONGLONG) {
          int_values.push_back(static_cast<int64_t>(param_numbers_[i]));
          null_flags.push_back(0);  // false
          
          bind.buffer_type = SEEKDB_TYPE_LONGLONG;
          bind.buffer = &int_values.back();
          bind.buffer_length = sizeof(int64_t);
          bind.is_null = reinterpret_cast<bool*>(&null_flags.back());
        } else if (param_type == SEEKDB_TYPE_DOUBLE) {
          double_values.push_back(param_numbers_[i]);
          null_flags.push_back(0);  // false
          
          bind.buffer_type = SEEKDB_TYPE_DOUBLE;
          bind.buffer = &double_values.back();
          bind.buffer_length = sizeof(double);
          bind.is_null = reinterpret_cast<bool*>(&null_flags.back());
        } else if (param_type == SEEKDB_TYPE_TINY) {
          bool_values.push_back(param_bools_[i] ? 1 : 0);
          null_flags.push_back(0);  // false
          
          bind.buffer_type = SEEKDB_TYPE_TINY;
          bind.buffer = &bool_values.back();
          bind.buffer_length = sizeof(uint8_t);
          bind.is_null = reinterpret_cast<bool*>(&null_flags.back());
        }
        
        binds.push_back(bind);
      }
      
      // IMPORTANT: Store buffers in member variables BEFORE building binds array
      // This ensures pointers in binds remain valid after move
      // Store buffers first to keep them alive during execution
      string_buffers_ = std::move(string_buffers);
      lengths_ = std::move(lengths);
      null_flags_ = std::move(null_flags);
      int_values_ = std::move(int_values);
      double_values_ = std::move(double_values);
      bool_values_ = std::move(bool_values);
      
      // Now rebuild binds array with pointers to member variables
      // This is necessary because move() invalidates pointers in the original binds
      binds.clear();
      size_t string_idx = 0;
      size_t length_idx = 0;
      size_t null_idx = 0;
      size_t int_idx = 0;
      size_t double_idx = 0;
      size_t bool_idx = 0;
      
      for (uint32_t i = 0; i < param_count_; i++) {
        SeekdbBind bind = {};
        SeekdbFieldType param_type = param_types_[i];
        SeekdbFieldType bind_type = param_type;
        if (param_type == SEEKDB_TYPE_STRING && i < varbinary_id_flags.size() && varbinary_id_flags[i]) {
          bind_type = SEEKDB_TYPE_VARBINARY_ID;
        }
        
        if (param_type == SEEKDB_TYPE_NULL) {
          bind.buffer_type = SEEKDB_TYPE_NULL;
          bind.is_null = reinterpret_cast<bool*>(&null_flags_[null_idx++]);
        } else if (param_type == SEEKDB_TYPE_STRING) {
          bind.buffer_type = bind_type;
          bind.buffer = string_buffers_[string_idx].data();
          bind.buffer_length = string_buffers_[string_idx].size() - 1;  // Exclude null terminator
          bind.length = &lengths_[length_idx++];
          bind.is_null = reinterpret_cast<bool*>(&null_flags_[null_idx++]);
          string_idx++;
        } else if (param_type == SEEKDB_TYPE_LONGLONG) {
          bind.buffer_type = SEEKDB_TYPE_LONGLONG;
          bind.buffer = &int_values_[int_idx++];
          bind.buffer_length = sizeof(int64_t);
          bind.is_null = reinterpret_cast<bool*>(&null_flags_[null_idx++]);
        } else if (param_type == SEEKDB_TYPE_DOUBLE) {
          bind.buffer_type = SEEKDB_TYPE_DOUBLE;
          bind.buffer = &double_values_[double_idx++];
          bind.buffer_length = sizeof(double);
          bind.is_null = reinterpret_cast<bool*>(&null_flags_[null_idx++]);
        } else if (param_type == SEEKDB_TYPE_TINY) {
          bind.buffer_type = SEEKDB_TYPE_TINY;
          bind.buffer = &bool_values_[bool_idx++];
          bind.buffer_length = sizeof(uint8_t);
          bind.is_null = reinterpret_cast<bool*>(&null_flags_[null_idx++]);
        }
        
        binds.push_back(bind);
      }
      
      binds_ = std::move(binds);

      // Use parameterized query API (C ABI layer handles parameter binding)
      // Note: The underlying library will auto-detect VECTOR type based on column schema
      // by preparing the statement first and checking column types
      
      // Check if this is a vector query
      bool is_vector_query = (sql_.find("cosine_distance") != std::string::npos || 
                              sql_.find("l2_distance") != std::string::npos ||
                              sql_.find("inner_product") != std::string::npos);
      
      ret = seekdb_query_with_params(
        conn_->handle,
        sql_.c_str(),
        &seekdb_result,
        binds_.data(),
        static_cast<unsigned int>(binds_.size())
      );
      // Fallback: if seekdb_query_with_params returned success but *result null, try seekdb_store_result(handle).
      if (ret == SEEKDB_SUCCESS && !seekdb_result && is_vector_query) {
        SeekdbResult stored_result = seekdb_store_result(conn_->handle);
        if (stored_result) {
          seekdb_result = stored_result;
        }
      }
    } else {
      bool is_vector_query = (sql_.find("cosine_distance") != std::string::npos ||
                              sql_.find("l2_distance") != std::string::npos ||
                              sql_.find("inner_product") != std::string::npos);
      (void)is_vector_query;
      ret = seekdb_query(conn_->handle, sql_.c_str(), &seekdb_result);
    }
    
    if (ret != SEEKDB_SUCCESS) {
      // Use connection-specific error first, fallback to thread-local error
      const char* error_msg = seekdb_error(conn_->handle);
      if (!error_msg) {
        error_msg = seekdb_last_error();
      }
      std::string error_str = error_msg ? error_msg : "Query failed";
      SetError(error_str);
      return;
    }
    
    // If query succeeded but result is null, try to get stored result
    // Note: For DML statements (INSERT/UPDATE/DELETE), result may be null but query succeeded
    // This is normal for DML statements, we should create an empty result set
    if (!seekdb_result) {
      seekdb_result = seekdb_store_result(conn_->handle);
    }
    if (!seekdb_result) {
      result_ = nullptr;
    } else {
      try {
        result_ = new SeekdbResultWrapper(seekdb_result);
      } catch (const std::bad_alloc& e) {
        SetError("Memory allocation failed: " + std::string(e.what()));
        return;
      } catch (const std::exception& e) {
        SetError("Exception in Execute: " + std::string(e.what()));
        return;
      }
    }
  }

  void OnOK() override {
    Napi::Env env = Env();
    Napi::HandleScope scope(env);
    
    // Handle queries with null result (empty result set)
    // This can happen for:
    // 1. DML statements (INSERT/UPDATE/DELETE) - normal, return empty result
    // 2. SELECT queries with no matching rows - also normal, return empty result with columns
    // Reference implementation creates empty result set in both cases
    if (!result_) {
      auto result_obj = Napi::Object::New(env);
      auto columns = Napi::Array::New(env, 0);
      auto rows = Napi::Array::New(env, 0);
      result_obj.Set("columns", columns);
      result_obj.Set("rows", rows);
      deferred_.Resolve(result_obj);
      return;
    }
    
    // Build result object
    auto result_obj = Napi::Object::New(env);
    
    // Set columns - ensure we have valid column names
    auto columns = Napi::Array::New(env, result_->column_names.size());
    for (size_t i = 0; i < result_->column_names.size(); i++) {
      // Ensure column name is not empty
      std::string col_name = result_->column_names[i];
      if (col_name.empty()) {
        col_name = "col_" + std::to_string(i);
      }
      columns.Set(i, Napi::String::New(env, col_name));
    }
    result_obj.Set("columns", columns);
    
    // Validate result handle
    if (!result_->result) {
      deferred_.Reject(Napi::Error::New(env, "Result handle is null").Value());
      return;
    }
    
    if (result_->column_count == 0) {
      auto rows = Napi::Array::New(env, 0);
      result_obj.Set("rows", rows);
      deferred_.Resolve(result_obj);
      return;
    }
    auto rows = Napi::Array::New(env, result_->row_count);
    bool has_field_info = !result_->field_info.empty() && result_->field_info.size() == static_cast<size_t>(result_->column_count);
    for (int64_t i = 0; i < result_->row_count; i++) {
      SeekdbRow row = seekdb_fetch_row(result_->result);
      if (row) {
        auto row_obj = Napi::Array::New(env, result_->column_count);
        
        for (int32_t j = 0; j < result_->column_count; j++) {
          const std::string& col_name = (j < static_cast<int32_t>(result_->column_names.size())) ? result_->column_names[j] : ("col_" + std::to_string(j));
          bool row_is_null = seekdb_row_is_null(row, j);
          // When C ABI reports null: try 2MB buffer first (long TEXT may be wrongly reported as null); if non-empty use it. If 2MB returns empty and str_len==0 treat as ""; if 2MB fails do not fall back to 1-byte (column may be long), set null.
          if (row_is_null) {
            size_t str_len = seekdb_row_get_string_len(row, j);
            const size_t fallback_buf_size = 2 * 1024 * 1024;
            std::vector<char> buf(fallback_buf_size, 0);
            int get_ret = seekdb_row_get_string(row, j, buf.data(), buf.size());
            if (get_ret == SEEKDB_SUCCESS && buf[0] != '\0') {
              row_obj.Set(j, Napi::String::New(env, buf.data()));
            } else if (get_ret == SEEKDB_SUCCESS && str_len == 0) {
              row_obj.Set(j, Napi::String::New(env, ""));
            } else if (get_ret == SEEKDB_SUCCESS) {
              row_obj.Set(j, env.Null());
            } else {
              // 2MB failed: do not try 1-byte (may be long content); set null
              row_obj.Set(j, env.Null());
            }
          } else {
            // Use field type information if available for optimized type detection
            if (has_field_info && result_->field_info[j]) {
              SeekdbField* field = result_->field_info[j];
              int32_t field_type = field->type;
              
              // Map MySQL field type to appropriate getter
              // Field types align with SeekdbFieldType enum values:
              // SEEKDB_TYPE_TINY=1, SHORT=2, LONG=3, LONGLONG=4
              // SEEKDB_TYPE_FLOAT=5, DOUBLE=6
              // SEEKDB_TYPE_STRING=11, BLOB=12
              bool value_set = false;
              
              // Try integer types (TINY, SHORT, LONG, LONGLONG) - types 1-4
              if (field_type >= 1 && field_type <= 4) {
                // For TINY (type 1), try boolean first if it makes sense
                if (field_type == 1) {
                  bool bool_val;
                  if (seekdb_row_get_bool(row, j, &bool_val) == SEEKDB_SUCCESS) {
                    row_obj.Set(j, Napi::Boolean::New(env, bool_val));
                    value_set = true;
                  }
                }
                // If boolean failed or not TINY, try int64
                if (!value_set) {
                  int64_t int_val;
                  if (seekdb_row_get_int64(row, j, &int_val) == SEEKDB_SUCCESS) {
                    row_obj.Set(j, Napi::Number::New(env, static_cast<double>(int_val)));
                    value_set = true;
                  }
                }
              }
              // Try floating point types (FLOAT, DOUBLE) - types 5-6
              else if (field_type == 5 || field_type == 6) {
                double double_val;
                if (seekdb_row_get_double(row, j, &double_val) == SEEKDB_SUCCESS) {
                  row_obj.Set(j, Napi::Number::New(env, double_val));
                  value_set = true;
                }
              }
              
              // For STRING/BLOB types (11-12): string getter. For VECTOR (40/13): C ABI may return JSON string (vector_binary_to_json) or binary; return as string so SDK can JSON.parse, or fallback to parseEmbeddingBinaryString for binary.
              if (!value_set || field_type == 11 || field_type == 12 || field_type == 40 || field_type == 13) {
                size_t str_len = seekdb_row_get_string_len(row, j);
                const size_t max_safe_len = 10 * 1024 * 1024;  // 10MB cap to avoid OOM
                const size_t fallback_buf_size = 2 * 1024 * 1024;  // 2MB for long document/metadata
                bool string_set = false;
                // When C ABI returns valid length for STRING/BLOB/VECTOR (and not 0 for long content)
                if (str_len != static_cast<size_t>(-1) && str_len > 0 && str_len <= max_safe_len) {
                  std::vector<char> buf(str_len + 1);
                  if (seekdb_row_get_string(row, j, buf.data(), buf.size()) == SEEKDB_SUCCESS) {
                    row_obj.Set(j, Napi::String::New(env, buf.data()));
                    string_set = true;
                  }
                }
                // When C ABI returns -1 or 0 for length (e.g. long TEXT/BLOB or wrong len): try large buffer for string-like columns
                if (!string_set && (field_type == 11 || field_type == 12 || field_type == 40 || field_type == 13 || !value_set)) {
                  std::vector<char> buf(fallback_buf_size, 0);
                  if (seekdb_row_get_string(row, j, buf.data(), buf.size()) == SEEKDB_SUCCESS) {
                    row_obj.Set(j, Napi::String::New(env, buf.data()));
                    string_set = true;
                  }
                }
                if (!string_set) {
                  row_obj.Set(j, env.Null());
                }
              }
            } else {
              // Fallback: get string length first when available to support long TEXT/BLOB (e.g. 100KB document)
              size_t str_len = seekdb_row_get_string_len(row, j);
              const size_t max_safe_len = 10 * 1024 * 1024;  // 10MB cap to avoid OOM
              const size_t fallback_buf_size = 2 * 1024 * 1024;  // 2MB when length unknown
              if (str_len != static_cast<size_t>(-1) && str_len <= max_safe_len) {
                std::vector<char> buf(str_len + 1, 0);
                int ret = seekdb_row_get_string(row, j, buf.data(), buf.size());
                if (ret == SEEKDB_SUCCESS) {
                  row_obj.Set(j, Napi::String::New(env, buf.data()));
                } else {
                  row_obj.Set(j, env.Null());
                }
              } else if (str_len == static_cast<size_t>(-1)) {
                // Length unknown (e.g. long TEXT/BLOB): try large buffer so long document/metadata not truncated
                std::vector<char> buf(fallback_buf_size, 0);
                int ret = seekdb_row_get_string(row, j, buf.data(), buf.size());
                if (ret == SEEKDB_SUCCESS) {
                  row_obj.Set(j, Napi::String::New(env, buf.data()));
                } else {
                  row_obj.Set(j, env.Null());
                }
              } else {
                // Length > 10MB: use fixed buffer (e.g. for numeric/boolean columns or legacy path)
                std::vector<char> buf(4096, 0);
                int ret = seekdb_row_get_string(row, j, buf.data(), buf.size());
                if (ret == SEEKDB_SUCCESS) {
                  std::string str_val(buf.data());
                  if (!str_val.empty()) {
                    char* end_ptr = nullptr;
                    double num_val = std::strtod(str_val.c_str(), &end_ptr);
                    if (*end_ptr == '\0' && end_ptr != str_val.c_str()) {
                      if (num_val == static_cast<int64_t>(num_val)) {
                        row_obj.Set(j, Napi::Number::New(env, static_cast<double>(static_cast<int64_t>(num_val))));
                      } else {
                        row_obj.Set(j, Napi::Number::New(env, num_val));
                      }
                    } else if (str_val == "true" || str_val == "1") {
                      row_obj.Set(j, Napi::Boolean::New(env, true));
                    } else if (str_val == "false" || str_val == "0") {
                      row_obj.Set(j, Napi::Boolean::New(env, false));
                    } else {
                      row_obj.Set(j, Napi::String::New(env, str_val));
                    }
                  } else {
                    row_obj.Set(j, env.Null());
                  }
                } else {
                  row_obj.Set(j, env.Null());
                }
              }
            }
          }
        }
        
        rows.Set(i, row_obj);
      } else {
        break;
      }
    }
    result_obj.Set("rows", rows);
    deferred_.Resolve(result_obj);
  }

  void OnError(const Napi::Error& e) override {
    deferred_.Reject(e.Value());
  }

 private:
  Napi::Promise::Deferred deferred_;
  SeekdbConnection* conn_;
  std::string sql_;
  bool has_params_;
  
  // Pre-extracted parameter values (extracted in constructor on main thread)
  uint32_t param_count_;
  std::vector<SeekdbFieldType> param_types_;
  std::vector<std::string> param_strings_;
  std::vector<double> param_numbers_;
  std::vector<bool> param_bools_;
  
  // Buffer storage for parameter binding (kept alive during execution)
  std::vector<SeekdbBind> binds_;
  std::vector<std::vector<char>> string_buffers_;
  std::vector<unsigned long> lengths_;
  std::vector<uint8_t> null_flags_;  // Use uint8_t instead of bool (std::vector<bool> is specialized and can't take address)
  std::vector<int64_t> int_values_;
  std::vector<double> double_values_;
  std::vector<uint8_t> bool_values_;  // Use uint8_t instead of bool (std::vector<bool> is specialized and can't take address)
  
  SeekdbResultWrapper* result_;
};

// Main addon class
class SeekdbNodeAddon : public Napi::Addon<SeekdbNodeAddon> {
 public:
  SeekdbNodeAddon(Napi::Env env, Napi::Object exports) {
    // Database operations
    DefineAddon(exports, {
      // function open(db_dir?: string): Database
      InstanceMethod("open", &SeekdbNodeAddon::open),
      
      // function open_with_service(db_dir?: string, port?: number): Database
      InstanceMethod("open_with_service", &SeekdbNodeAddon::open_with_service),
      
      // function close_sync(database: Database): void
      InstanceMethod("close_sync", &SeekdbNodeAddon::close_sync),
      
      // function connect(database: Database, database_name: string, autocommit: boolean): Connection
      InstanceMethod("connect", &SeekdbNodeAddon::connect),
      
      // function disconnect(connection: Connection): void
      InstanceMethod("disconnect", &SeekdbNodeAddon::disconnect),
      
      // function execute(connection: Connection, sql: string): Promise<Result>
      InstanceMethod("execute", &SeekdbNodeAddon::execute),
    });
  }

 private:
  // function open(db_dir?: string): Database
  Napi::Value open(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    
    std::string db_dir = "";
    if (info.Length() > 0 && !info[0].IsUndefined() && !info[0].IsNull()) {
      db_dir = info[0].As<Napi::String>().Utf8Value();
    }
    
    // Call seekdb_open
    int ret = seekdb_open(db_dir.empty() ? nullptr : db_dir.c_str());
    if (ret != SEEKDB_SUCCESS) {
      const char* error = seekdb_last_error();
      throw Napi::Error::New(env, error ? error : "Failed to open database");
    }
    
    // Create database wrapper (just a marker)
    auto db = new SeekdbDatabase(db_dir);
    
    return CreateExternal<SeekdbDatabase>(env, DatabaseTypeTag, db);
  }
  
  // function open_with_service(db_dir?: string, port?: number): Database
  Napi::Value open_with_service(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    
    std::string db_dir = "";
    int port = 0; // Default to embedded mode (port <= 0)
    
    if (info.Length() > 0 && !info[0].IsUndefined() && !info[0].IsNull()) {
      db_dir = info[0].As<Napi::String>().Utf8Value();
    }
    
    if (info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()) {
      if (info[1].IsNumber()) {
        port = info[1].As<Napi::Number>().Int32Value();
      }
    }
    
    // Call seekdb_open_with_service
    // If port > 0, runs in server mode; if port <= 0, runs in embedded mode
    int ret = seekdb_open_with_service(db_dir.empty() ? nullptr : db_dir.c_str(), port);
    if (ret != SEEKDB_SUCCESS) {
      const char* error = seekdb_last_error();
      throw Napi::Error::New(env, error ? error : "Failed to open database with service");
    }
    
    // Create database wrapper (just a marker)
    auto db = new SeekdbDatabase(db_dir);
    
    return CreateExternal<SeekdbDatabase>(env, DatabaseTypeTag, db);
  }
  
  // function close_sync(database: Database): void
  Napi::Value close_sync(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto db = GetDatabaseFromExternal(env, info[0]);
    
    // Call seekdb_close (global close)
    seekdb_close();
    
    delete db;
    
    return env.Undefined();
  }
  
  // function connect(database: Database, database_name: string, autocommit: boolean): Connection
  Napi::Value connect(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    // Validate database parameter (db is not used but needed for type checking)
    (void)GetDatabaseFromExternal(env, info[0]);
    std::string db_name = info[1].As<Napi::String>().Utf8Value();
    bool autocommit = info[2].As<Napi::Boolean>().Value();
    
    // Call seekdb_connect
    SeekdbHandle handle = nullptr;
    int ret = seekdb_connect(&handle, db_name.c_str(), autocommit);
    if (ret != SEEKDB_SUCCESS) {
      const char* error = seekdb_last_error();
      throw Napi::Error::New(env, error ? error : "Failed to connect");
    }
    
    auto conn = new SeekdbConnection(handle, db_name, autocommit);
    
    return CreateExternal<SeekdbConnection>(env, ConnectionTypeTag, conn);
  }
  
  // function disconnect(connection: Connection): void
  Napi::Value disconnect(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto conn = GetConnectionFromExternal(env, info[0]);
    
    // Manually close the connection before deleting to avoid double-free
    // Set handle to nullptr so destructor won't try to close again
    if (conn && conn->handle) {
      seekdb_connect_close(conn->handle);
      conn->handle = nullptr;
    }
    
    // Connection cleanup is handled by destructor
    delete conn;
    
    return env.Undefined();
  }
  
  // function execute(connection: Connection, sql: string, params?: any[]): Promise<Result>
  Napi::Value execute(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    
    if (info.Length() < 2) {
      throw Napi::TypeError::New(env, "Expected connection and sql");
    }
    
    auto conn = GetConnectionFromExternal(env, info[0]);
    std::string sql = info[1].As<Napi::String>().Utf8Value();
    
    // Check if parameters are provided
    Napi::Array params;
    bool has_params = false;
    if (info.Length() >= 3 && !info[2].IsUndefined() && !info[2].IsNull()) {
      if (info[2].IsArray()) {
        params = info[2].As<Napi::Array>();
        if (params.Length() > 0) {
          has_params = true;
        }
      }
    }
    
    // Create promise
    auto deferred = Napi::Promise::Deferred::New(env);
    
    // Create and queue async worker
    ExecuteWorker* worker;
    if (has_params) {
      worker = new ExecuteWorker(deferred, conn, sql, params);
    } else {
      worker = new ExecuteWorker(deferred, conn, sql);
    }
    worker->Queue();
    
    return deferred.Promise();
  }
};

NODE_API_ADDON(SeekdbNodeAddon)
