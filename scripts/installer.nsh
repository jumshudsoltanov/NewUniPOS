!macro customInstall
  DetailPrint "Installing MariaDB in background..."
  nsExec::ExecToLog '"$INSTDIR\resources\source\install-mariadb.bat"'
  
  DetailPrint "Adding UniPOS to Windows Startup..."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "UniPOS" '"$INSTDIR\UniPOS.exe"'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "UniPOS"
!macroend
