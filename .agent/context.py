import os

def load_file_content(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return None # Signal failure

def build_full_context(repo_root):
    context_buffer = ""
    found_files = []
    missing_files = []
    total_chars = 0

    print("🔍 --- Context Loading Report ---")

    # 1. STATIC CORE DOCS (Adjust filenames if needed)
    static_docs = [
        "GEMINI.md",
        "docs/PRD.md",
        "docs/TECHNICAL_SPECIFICATION.md",
        "docs/DEVELOPMENT_PROCESS.md",
        "docs/IMPLEMENTATION_PLAN.md"
    ]
    
    context_buffer += "\n\n# === CORE PROJECT DOCUMENTATION ===\n"
    for doc in static_docs:
        full_path = os.path.join(repo_root, doc)
        if os.path.exists(full_path):
            content = load_file_content(full_path)
            if content is not None:
                char_count = len(content)
                context_buffer += f"\n## File: {doc}\n{content}\n"
                found_files.append((doc, char_count))
                total_chars += char_count
            else:
                missing_files.append(f"{doc} (Error reading file)")
        else:
            missing_files.append(doc)

    # 2. DYNAMIC CONTEXT (Files dropped in .agent/dynamic_context)
    dynamic_folder = os.path.join(repo_root, ".agent/dynamic_context")
    if os.path.exists(dynamic_folder):
        context_buffer += "\n\n# === ADDITIONAL CONTEXT ===\n"
        # Walk just the top level of dynamic_context
        for filename in os.listdir(dynamic_folder):
            if filename.startswith('.'): continue # Skip hidden files
            
            filepath = os.path.join(dynamic_folder, filename)
            
            # Skip directories if you only want flat files, or use os.walk for recursive
            if os.path.isdir(filepath): continue
            
            content = load_file_content(filepath)
            if content is not None:
                char_count = len(content)
                context_buffer += f"\n## Context File: {filename}\n{content}\n"
                found_files.append((f"dynamic/{filename}", char_count))
                total_chars += char_count
    
    # 3. PRINT VERBOSE REPORT
    if found_files:
        print("✅ FOUND:")
        for name, count in found_files:
            print(f"   - {name:<40} : {count:>7} chars")
    
    if missing_files:
        print("❌ MISSING (Skipped):")
        for name in missing_files:
            print(f"   - {name}")

    print(f"📦 Total Context Size: {total_chars} chars")
    print("-------------------------------\n")
    
    return context_buffer