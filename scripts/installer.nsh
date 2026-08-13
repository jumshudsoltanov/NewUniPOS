!macro customInstall
  DetailPrint "Installing MariaDB..."
  
  ; Run the batch file as Administrator using ShellExecWait
  ; "runas" ensures it runs with elevated (admin) privileges
  ShellExecWait "runas" "$INSTDIR\resources\source\install-mariadb.bat" "" "$INSTDIR\resources\source" SW_HIDE
  
  DetailPrint "Adding UniPOS to Windows Startup..."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "UniPOS" '"$INSTDIR\UniPOS.exe"'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "UniPOS"
!macroend
