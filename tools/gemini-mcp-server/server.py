import subprocess
from mcp.server.fastmcp import FastMCP
from typing import Optional
import os

# Initialize the MCP server
mcp = FastMCP("MyProjectTools")

@mcp.tool()
def deploy_app_to_prod() -> str:
    """Deploys the GoodNumbers to production using the deploy.sh script to production
    
    Args: It takes no arguments
    """
    command = [os.path.join(".", "deploy.sh"), "-yes"]

    try:
        # Run the command and capture its output
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            cwd=os.path.abspath(".") # You might need to adjust this to the correct path of your script
        )
        # Return the stdout of the script
        return f"Deployment successful:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        # If the script fails, return the stderr as an error
        return f"Deployment failed with an error:\n {e}\n{e.stderr}"

# The main entry point for the server
if __name__ == "__main__":
    mcp.run()
