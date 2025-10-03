# Bundle all .env* files into a tarball
bundle-env-files:
    @echo "Bundling all .env* files..."
    @find . -name ".env*" -print0 | xargs -0 tar -czvf ../env_files.tar.gz
    @echo "✅ Done. Tarball created at ../env_files.tar.gz"
