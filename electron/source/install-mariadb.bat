@echo off
setlocal enabledelayedexpansion
echo [LOG] Script started at %time% > "C:\MariaDB_Install_Log.txt"

echo [INFO] Running with Administrator privileges. >> "C:\MariaDB_Install_Log.txt"

:: Check and install Visual C++ 2019 Redistributable (required for MariaDB 10.4)
echo [+] Checking Visual C++ 2019 Redistributable... >> "C:\MariaDB_Install_Log.txt"
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Version >nul 2>&1
if %errorlevel% neq 0 (
    reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Version >nul 2>&1
)
if %errorlevel% neq 0 (
    echo [INFO] VC++ 2019 not found. Installing... >> "C:\MariaDB_Install_Log.txt"
    if exist "%CURRENT_DIR%\vcredist_x86.exe" (
        start /wait "" "%CURRENT_DIR%\vcredist_x86.exe" /install /quiet /norestart
        echo [OK] VC++ 2019 installed. >> "C:\MariaDB_Install_Log.txt"
    ) else (
        echo [WARN] vcredist_x86.exe not found in source folder. MariaDB may fail on Windows 7. >> "C:\MariaDB_Install_Log.txt"
    )
) else (
    echo [OK] VC++ 2019 already installed. >> "C:\MariaDB_Install_Log.txt"
)


echo ===================================================
echo        MariaDB Installation Setup
echo ===================================================

:: Set current directory where the script is located
set "CURRENT_DIR=%~dp0"
if "%CURRENT_DIR:~-1%"=="\" set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

:: --- DATABASE CONFIGURATION ---
set "SOURCE_FOLDER=%CURRENT_DIR%\mariadb-10.4.22-win32"
set "TARGET_DIR=C:\Program Files\MariaDB"
set "DATA_DIR=%TARGET_DIR%\data"
set "DB_NAME=unipos-new"
set "DB_PASS=$2a$12$9IuwxtJ27i1RGqV/3m/OB.Lr2tilbrHvVPHUv06MmTMwDSwHTExW."
:: ------------------------------

:: Check if port 3306 is already in use
netstat -ano | findstr ":3306 " >nul
if %errorlevel% equ 0 (
    echo [INFO] Port 3306 is already in use (MariaDB or MySQL might be running). >> "C:\MariaDB_Install_Log.txt"
    echo [INFO] Skipping installation to prevent conflicts. >> "C:\MariaDB_Install_Log.txt"
    exit /b 0
)

:: Check if MariaDB service exists
sc query MariaDB >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] MariaDB service is already installed on the system. >> "C:\MariaDB_Install_Log.txt"
    echo [INFO] Skipping installation. >> "C:\MariaDB_Install_Log.txt"
    sc config MariaDB start= auto >nul 2>&1
    net start MariaDB >nul 2>&1
    exit /b 0
)

:: Check if MySQL service exists
sc query MySQL >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] MySQL service is already installed on the system.
    echo [INFO] Skipping installation.
    sc config MySQL start= auto >nul 2>&1
    net start MySQL >nul 2>&1
    exit /b 0
)

if exist "%DATA_DIR%\mysql" (
    echo [INFO] MariaDB files already exist in %DATA_DIR%. >> "C:\MariaDB_Install_Log.txt"
    echo [INFO] Skipping installation to prevent data loss. >> "C:\MariaDB_Install_Log.txt"
    exit /b 0
)

if not exist "%SOURCE_FOLDER%" (
    echo [ERROR] Source folder '%SOURCE_FOLDER%' not found! >> "C:\MariaDB_Install_Log.txt"
    exit /b
)

echo [+] 1. Cleaning up old files in C:\Program Files\MariaDB... >> "C:\MariaDB_Install_Log.txt"
sc stop MariaDB >nul 2>&1
sc delete MariaDB >nul 2>&1
timeout /t 2 >nul
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"

echo [+] 2. Copying files to C:\Program Files\MariaDB... >> "C:\MariaDB_Install_Log.txt"
xcopy "%SOURCE_FOLDER%\*" "%TARGET_DIR%" /E /H /Y >nul
echo [OK] Files copied successfully. >> "C:\MariaDB_Install_Log.txt"

echo [+] 3. Creating Data directory...
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo [+] 4. Creating my.ini configuration file...
(
echo [mysqld]
echo basedir="%TARGET_DIR%"
echo datadir="%DATA_DIR%"
echo port=3306
echo character-set-server=utf8mb4
echo collation-server=utf8mb4_unicode_ci
) > "%TARGET_DIR%\my.ini"

echo [+] 5. Initializing system database (mysql_install_db)... >> "C:\MariaDB_Install_Log.txt"
cd /d "%TARGET_DIR%\bin"
mysql_install_db.exe --datadir="%DATA_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] An error occurred during database initialization! >> "C:\MariaDB_Install_Log.txt"
    exit /b
)

echo [+] 6. Installing Windows Service automatically... >> "C:\MariaDB_Install_Log.txt"
mysqld.exe --install MariaDB --defaults-file="%TARGET_DIR%\my.ini"
sc config MariaDB start= auto

echo [+] 7. Starting MariaDB Service... >> "C:\MariaDB_Install_Log.txt"
net start MariaDB
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start MariaDB service! >> "C:\MariaDB_Install_Log.txt"
    exit /b
)

echo [+] 8. Setting Root password and creating '%DB_NAME%' database...
mysqladmin.exe -u root password "%DB_PASS%"

(
echo DELETE FROM mysql.user WHERE User='';
echo FLUSH PRIVILEGES;
echo DROP DATABASE IF EXISTS `new-unipos`;
echo CREATE DATABASE IF NOT EXISTS `%DB_NAME%` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
) > "%TEMP%\init.sql"

mysql.exe -u root -p"%DB_PASS%" < "%TEMP%\init.sql"
del "%TEMP%\init.sql"

echo =================================================== >> "C:\MariaDB_Install_Log.txt"
echo [SUCCESS] INSTALLATION COMPLETED WITH NEW DATABASE! >> "C:\MariaDB_Install_Log.txt"
echo [-] New Database Name: %DB_NAME% >> "C:\MariaDB_Install_Log.txt"
echo [-] User: root >> "C:\MariaDB_Install_Log.txt"
echo =================================================== >> "C:\MariaDB_Install_Log.txt"
