@echo off
setlocal enabledelayedexpansion
echo [LOG] Script started at %time% > "C:\MariaDB_Install_Log.txt"
echo [INFO] Running with Administrator privileges. >> "C:\MariaDB_Install_Log.txt"

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

echo [INFO] SOURCE: %SOURCE_FOLDER% >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 1: Check if MariaDB is already INSTALLED or WORKING
::         If data directory exists, skip installation to PREVENT DATA LOSS.
:: ============================================================
echo [INFO] Checking if MariaDB is already installed... >> "C:\MariaDB_Install_Log.txt"

if exist "%DATA_DIR%\mysql" (
    echo [INFO] MariaDB data directory exists at %DATA_DIR%. Database is already installed! >> "C:\MariaDB_Install_Log.txt"
    echo [INFO] Skipping fresh installation to prevent DATA LOSS. >> "C:\MariaDB_Install_Log.txt"
    :: Try to start the service just in case it was stopped
    net start MariaDB >nul 2>&1
    exit /b 0
)

if exist "%DATA_DIR%" (
    echo [INFO] MariaDB data folder exists. Skipping installation to prevent data loss. >> "C:\MariaDB_Install_Log.txt"
    net start MariaDB >nul 2>&1
    exit /b 0
)

set "MARIADB_RUNNING=0"
sc query MariaDB >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%s in ('sc query MariaDB ^| findstr /i "STATE"') do (
        if /i "%%s"=="RUNNING" set "MARIADB_RUNNING=1"
    )
)
if "%MARIADB_RUNNING%"=="1" (
    echo [INFO] MariaDB is already RUNNING. Skipping installation. >> "C:\MariaDB_Install_Log.txt"
    exit /b 0
)

set "MYSQL_RUNNING=0"
sc query MySQL >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%s in ('sc query MySQL ^| findstr /i "STATE"') do (
        if /i "%%s"=="RUNNING" set "MYSQL_RUNNING=1"
    )
)
if "%MYSQL_RUNNING%"=="1" (
    echo [INFO] MySQL is already RUNNING. Skipping installation. >> "C:\MariaDB_Install_Log.txt"
    exit /b 0
)

echo [INFO] No working DB found and no data directory exists. Proceeding with fresh MariaDB install... >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 2: Check VC++ 2019 x86 (required for MariaDB 10.4)
:: ============================================================
echo [+] Checking Visual C++ 2019 Redistributable... >> "C:\MariaDB_Install_Log.txt"
set "VCPP_OK=0"
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Version >nul 2>&1
if %errorlevel% equ 0 set "VCPP_OK=1"
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Version >nul 2>&1
if %errorlevel% equ 0 set "VCPP_OK=1"

if "%VCPP_OK%"=="0" (
    echo [INFO] VC++ 2019 not found. Installing... >> "C:\MariaDB_Install_Log.txt"
    if exist "%CURRENT_DIR%\vcredist_x86.exe" (
        start /wait "" "%CURRENT_DIR%\vcredist_x86.exe" /install /quiet /norestart
        echo [OK] VC++ 2019 installed. >> "C:\MariaDB_Install_Log.txt"
    ) else (
        echo [WARN] vcredist_x86.exe not found. Continuing anyway... >> "C:\MariaDB_Install_Log.txt"
    )
) else (
    echo [OK] VC++ 2019 already installed. >> "C:\MariaDB_Install_Log.txt"
)

:: ============================================================
:: STEP 3: Check source folder
:: ============================================================
if not exist "%SOURCE_FOLDER%" (
    echo [ERROR] Source folder not found: %SOURCE_FOLDER% >> "C:\MariaDB_Install_Log.txt"
    exit /b 1
)
echo [OK] Source folder found. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 4: Full cleanup of any previous broken installation
:: ============================================================
echo [+] Stopping and removing old MariaDB/MySQL services... >> "C:\MariaDB_Install_Log.txt"
net stop MariaDB >nul 2>&1
net stop MySQL >nul 2>&1
sc stop MariaDB >nul 2>&1
sc stop MySQL >nul 2>&1
timeout /t 3 >nul
sc delete MariaDB >nul 2>&1
sc delete MySQL >nul 2>&1
timeout /t 2 >nul

echo [+] Removing old MariaDB files from %TARGET_DIR%... >> "C:\MariaDB_Install_Log.txt"
if exist "%TARGET_DIR%" (
    if exist "%DATA_DIR%" (
        echo [WARNING] Data directory exists! We will NOT delete %TARGET_DIR% to protect data. >> "C:\MariaDB_Install_Log.txt"
    ) else (
        rmdir /s /q "%TARGET_DIR%" >nul 2>&1
        timeout /t 2 >nul
        mkdir "%TARGET_DIR%"
    )
) else (
    mkdir "%TARGET_DIR%"
)
echo [OK] Cleanup done. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 5: Copy MariaDB files
:: ============================================================
echo [+] Copying MariaDB files... >> "C:\MariaDB_Install_Log.txt"
xcopy "%SOURCE_FOLDER%\*" "%TARGET_DIR%" /E /H /Y >nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy files! >> "C:\MariaDB_Install_Log.txt"
    exit /b 1
)
echo [OK] Files copied. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 6: Create data dir and config
:: ============================================================
echo [+] Creating data directory and my.ini... >> "C:\MariaDB_Install_Log.txt"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

(
echo [mysqld]
echo basedir="%TARGET_DIR%"
echo datadir="%DATA_DIR%"
echo port=3306
echo character-set-server=utf8mb4
echo collation-server=utf8mb4_unicode_ci
) > "%TARGET_DIR%\my.ini"
echo [OK] my.ini created. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 7: Initialize database
:: ============================================================
echo [+] Initializing database (mysql_install_db)... >> "C:\MariaDB_Install_Log.txt"
cd /d "%TARGET_DIR%\bin"
mysql_install_db.exe --datadir="%DATA_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed! Errorlevel=%errorlevel% >> "C:\MariaDB_Install_Log.txt"
    exit /b 1
)
echo [OK] Database initialized. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 8: Install and start service
:: ============================================================
echo [+] Installing MariaDB Windows service... >> "C:\MariaDB_Install_Log.txt"
mysqld.exe --install MariaDB --defaults-file="%TARGET_DIR%\my.ini"
sc config MariaDB start= auto >nul 2>&1
echo [OK] Service installed. >> "C:\MariaDB_Install_Log.txt"

echo [+] Starting MariaDB service... >> "C:\MariaDB_Install_Log.txt"
net start MariaDB
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start MariaDB! Errorlevel=%errorlevel% >> "C:\MariaDB_Install_Log.txt"
    exit /b 1
)
echo [OK] MariaDB service started. >> "C:\MariaDB_Install_Log.txt"

:: ============================================================
:: STEP 9: Set password and create database
:: ============================================================
echo [+] Setting root password and creating database... >> "C:\MariaDB_Install_Log.txt"
mysqladmin.exe -u root password "%DB_PASS%"

(
echo DELETE FROM mysql.user WHERE User='';
echo FLUSH PRIVILEGES;
echo DROP DATABASE IF EXISTS `new-unipos`;
echo CREATE DATABASE IF NOT EXISTS `%DB_NAME%` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
) > "%TEMP%\init.sql"

mysql.exe -u root -p"%DB_PASS%" < "%TEMP%\init.sql"
del "%TEMP%\init.sql" >nul 2>&1

echo =================================================== >> "C:\MariaDB_Install_Log.txt"
echo [SUCCESS] MariaDB installed and running! >> "C:\MariaDB_Install_Log.txt"
echo [-] Database: %DB_NAME% >> "C:\MariaDB_Install_Log.txt"
echo [-] User: root >> "C:\MariaDB_Install_Log.txt"
echo [-] Port: 3306 >> "C:\MariaDB_Install_Log.txt"
echo =================================================== >> "C:\MariaDB_Install_Log.txt"
