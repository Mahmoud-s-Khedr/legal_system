Here is a summary of the problem found by a user and the suggested solutions fot it:

### The Problem
When running your packaged desktop application on a fresh Windows machine, the embedded PostgreSQL database fails to initialize, showing system errors that **`VCRUNTIME140.dll`** and **`MSVCP140.dll`** were not found. 

This happens because the official Windows binaries for PostgreSQL (`initdb.exe`, `postgres.exe`) are compiled using Microsoft Visual C++ and dynamically link to these specific runtime libraries. If the end-user does not already have the Microsoft Visual C++ Redistributable installed globally on their system, the database processes cannot start.

### The Solutions

**1. The End-User Workaround**
The quickest fix for an individual user experiencing the crash is to manually download and install the latest **Microsoft Visual C++ Redistributable** (`vc_redist.x64.exe`) directly from Microsoft's website. 

**2. The Developer Fix: "App-Local" Deployment (Recommended)**
To prevent users from ever seeing this error, the developer can bundle the missing `.dll` files directly inside the application package. Because Windows always checks the local directory of an executable for dependencies first, placing `vcruntime140.dll`, `msvcp140.dll`, (and `vcruntime140_1.dll`) right next to the PostgreSQL binaries in the `bin` folder solves the issue seamlessly without requiring admin rights or global installations.

* **Implementation:** Update your CI build script (`bundle-windows-deps.ps1`) to copy these specific DLLs from the GitHub Actions runner (located at `C:\Windows\System32`) into your extracted PostgreSQL `bin` directory right before Tauri builds the final installer.

**3. The Developer Fix: Chained Installer**
An alternative approach is to bundle the official Microsoft installer (`vc_redist.x64.exe`) with your app and configure your installation framework (like NSIS) to run it silently in the background while your app installs. While effective, this requires the installer to request administrator privileges from the user.


I want you to review this and choose the best most reliable fix