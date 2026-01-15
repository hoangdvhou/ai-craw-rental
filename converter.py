import pandas as pd
import yaml
import argparse
import os
import sys

def load_config(config_path):
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def detect_format(df, sources):
    """
    Detects the source format based on column matching.
    Returns the source config that matches the most fingerprint columns.
    """
    best_match = None
    max_matches = 0
    
    columns = set(df.columns)
    
    for source in sources:
        fingerprint = set(source.get('fingerprint_columns', []))
        matches = len(columns.intersection(fingerprint))
        
        if matches > max_matches:
            max_matches = matches
            best_match = source
            
    return best_match

def standardize_data(df, source_config, standard_columns):
    """
    Renames columns according to mapping and ensures standard schema.
    """
    mapping = source_config['mapping']
    
    # Rename columns
    # Invert mapping to rename from source to target
    # The config is source_col: target_col
    # df.rename expects {source_col: target_col} which is exactly what mapping is
    df_renamed = df.rename(columns=mapping)
    
    # Create final dataframe with standard columns
    final_df = pd.DataFrame()
    
    for col_def in standard_columns:
        col_name = col_def['name']
        col_type = col_def['type']
        
        if col_name in df_renamed.columns:
            final_df[col_name] = df_renamed[col_name]
        else:
            final_df[col_name] = None # Fill missing standard columns with None
            
        # Basic type conversion (can be expanded)
        if col_type == 'float':
            final_df[col_name] = pd.to_numeric(final_df[col_name], errors='coerce')
        elif col_type == 'string':
             final_df[col_name] = final_df[col_name].astype(str).replace('nan', '')
             
    # Add source meta
    final_df['source_format'] = source_config['name']
    
    return final_df

def process_file(file_path, config):
    print(f"Processing {file_path}...")
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(file_path)
        elif ext in ['.xls', '.xlsx']:
            df = pd.read_excel(file_path)
        else:
            print(f"Skipping unsupported file type: {ext}")
            return None
            
        source_config = detect_format(df, config['sources'])
        
        if not source_config:
            print(f"Could not detect format for {file_path}. Skipping.")
            print(f"Columns found: {list(df.columns)}")
            return None
            
        print(f"Detected format: {source_config['name']}")
        standardized_df = standardize_data(df, source_config, config['standard_columns'])
        return standardized_df
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Convert crawled data to standard format.')
    parser.add_argument('--input', required=True, help='Input directory or file path')
    parser.add_argument('--output', required=True, help='Output file path (CSV)')
    parser.add_argument('--config', default='config.yaml', help='Path to configuration file')
    
    args = parser.parse_args()
    
    config = load_config(args.config)
    
    all_data = []
    
    if os.path.isdir(args.input):
        for file in os.listdir(args.input):
            if file.startswith('.'): continue
            file_path = os.path.join(args.input, file)
            if os.path.isfile(file_path):
                df = process_file(file_path, config)
                if df is not None:
                    all_data.append(df)
    elif os.path.isfile(args.input):
        df = process_file(args.input, config)
        if df is not None:
            all_data.append(df)
            
    if all_data:
        final_result = pd.concat(all_data, ignore_index=True)
        final_result.to_csv(args.output, index=False)
        print(f"Successfully converted {len(all_data)} files to {args.output}")
        print(f"Total rows: {len(final_result)}")
    else:
        print("No data converted.")

if __name__ == "__main__":
    main()
