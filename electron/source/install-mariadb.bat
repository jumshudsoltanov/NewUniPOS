@echo off
setlocal enabledelayedexpansion

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Please run this file as Administrator!
    exit /b
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

if not exist "%SOURCE_FOLDER%" (
    echo [ERROR] Source folder '%SOURCE_FOLDER%' not found!
    exit /b
)

echo [+] 1. Cleaning up old files in C:\Program Files\MariaDB...
sc stop MariaDB >nul 2>&1
sc delete MariaDB >nul 2>&1
timeout /t 2 >nul
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"

echo [+] 2. Copying files to C:\Program Files\MariaDB...
xcopy "%SOURCE_FOLDER%\*" "%TARGET_DIR%" /E /H /Y >nul
echo [OK] Files copied successfully.

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

echo [+] 5. Initializing system database (mysql_install_db)...
cd /d "%TARGET_DIR%\bin"
mysql_install_db.exe --datadir="%DATA_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] An error occurred during database initialization!
    exit /b
)

echo [+] 6. Installing Windows Service automatically...
mysqld.exe --install MariaDB --defaults-file="%TARGET_DIR%\my.ini"
sc config MariaDB start= auto

echo [+] 7. Starting MariaDB Service...
net start MariaDB
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start MariaDB service!
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

echo ===================================================
echo [SUCCESS] INSTALLATION COMPLETED WITH NEW DATABASE!
echo [-] New Database Name: %DB_NAME%
echo [-] User: root
echo ===================================================
