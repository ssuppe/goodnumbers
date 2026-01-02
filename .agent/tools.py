import os
import fnmatch

# --- CONFIGURATION ---
# Folders to ignore during search to keep performance high and noise low
SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", 
    "dist", "build", "coverage", ".next", ".agent"
}

# --- TOOL IMPLEMENTATIONS ---

def list_files(path=".", recursive=False):
    """
    Lists files in a directory.
    """
    try:
        if recursive:
            files = []
            for root, dirs, filenames in os.walk(path):
                # Filter out ignored directories
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
                
                for filename in filenames:
                    files.append(os.path.join(root, filename))
            return "\n".join(files[:500]) # Cap output
        else:
            return "\n".join(os.listdir(path))
    except Exception as e:
        return f"Error listing files: {str(e)}"

def read_file(filepath):
    """
    Reads the content of a specific file.
    """
    try:
        if not os.path.exists(filepath):
            return f"Error: File '{filepath}' does not exist."
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            return f"--- START OF FILE: {filepath} ---\n{content}\n--- END OF FILE ---"
    except UnicodeDecodeError:
        return f"Error: File '{filepath}' appears to be binary or non-UTF-8."
    except Exception as e:
        return f"Error reading file: {str(e)}"

def search_content(query, path="."):
    """
    Searches for a string inside files (Grep-like).
    """
    results = []
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f):
                            if query in line:
                                # Clean whitespace for context
                                snippet = line.strip()[:200] 
                                results.append(f"{filepath}:{i+1}: {snippet}")
                                
                                # Limit results to prevent context explosion
                                if len(results) >= 20:
                                    return "\n".join(results) + "\n... (Truncated: too many matches)"
                except:
                    continue # Skip unreadable files
                    
        return "\n".join(results) if results else "No matches found."
    except Exception as e:
        return f"Error searching files: {str(e)}"

def find_files(pattern, path="."):
    """
    Finds files matching a filename pattern (e.g., '*.ts').
    """
    matches = []
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            
            for filename in files:
                if fnmatch.fnmatch(filename, pattern):
                    matches.append(os.path.join(root, filename))
                    
        return "\n".join(matches[:100]) if matches else "No matching files found."
    except Exception as e:
        return f"Error finding files: {str(e)}"

# --- TOOL SCHEMAS ---

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files in a directory. Good for exploring structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (default '.')"},
                    "recursive": {"type": "boolean", "description": "True to list subfolders"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the full content of a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to the file"}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_content",
            "description": "Search for a specific string inside all files (like grep).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The string to search for"},
                    "path": {"type": "string", "description": "Root path to start search (default '.')"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_files",
            "description": "Find files by name pattern (e.g. '*.test.ts').",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Filename pattern (e.g. '*.json')"},
                    "path": {"type": "string", "description": "Root path to start search (default '.')"}
                },
                "required": ["pattern"]
            }
        }
    }
]

# --- EXECUTION MAP ---

AVAILABLE_FUNCTIONS = {
    "list_files": list_files,
    "read_file": read_file,
    "search_content": search_content,
    "find_files": find_files
}