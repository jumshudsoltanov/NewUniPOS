!macro customInstall
  DetailPrint "Installing MariaDB in background..."
  nsExec::ExecToLog '"$INSTDIR\resources\source\install-mariadb.bat"'
!macroend
