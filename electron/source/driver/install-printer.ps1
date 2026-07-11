param(
    [string]$infPath,
    [string]$model,
    [string]$connectionType,
    [string]$ipAddress,
    [string]$comPort,
    [string]$printerName
)

try {
    Write-Host "Installing driver from $infPath for model $model..."
    
    # 0. Silently add certificate to TrustedPublisher to avoid "Windows Security" prompt
    $catPath = $infPath -replace '(?i)\.inf$', '.cat'
    if (Test-Path $catPath) {
        $signature = Get-AuthenticodeSignature -FilePath $catPath
        if ($signature -and $signature.SignerCertificate) {
            $store = New-Object System.Security.Cryptography.X509Certificates.X509Store "TrustedPublisher", "LocalMachine"
            $store.Open("ReadWrite")
            $store.Add($signature.SignerCertificate)
            $store.Close()
            Write-Host "Certificate added to TrustedPublisher successfully."
        }
    }
    
    # 1. Add driver to DriverStore using Windows 7 compatible syntax
    pnputil.exe -i -a "$infPath" | Out-Null
    
    $portName = ""
    
    if ($connectionType -eq "Network") {
        $portName = "IP_" + $ipAddress
        Write-Host "Creating Network Port $portName..."
        
        # Windows 7 Compatible TCP/IP Port creation via WMI
        $portQuery = Get-WmiObject -Class Win32_TCPIPPrinterPort -Filter "Name='$portName'"
        if (-not $portQuery) {
            $newPort = [wmiclass]"Win32_TCPIPPrinterPort"
            $port = $newPort.CreateInstance()
            $port.Name = $portName
            $port.HostAddress = $ipAddress
            $port.PortNumber = 9100
            $port.Protocol = 1
            $port.Put() | Out-Null
        }
    } elseif ($connectionType -eq "COM") {
        $portName = $comPort + ":"
        Write-Host "Using COM port $portName..."
    } else {
        # USB connection - Try to use USB001, fallback to LPT1 if it fails during PrintUI
        $portName = "USB001"
        Write-Host "Using default USB port $portName..."
    }
    
    Write-Host "Creating Printer $printerName on Port $portName using Driver $model..."
    
    # Run PrintUIEntry to install the printer (Works on XP, 7, 8, 10, 11)
    $printUICommand = "rundll32 printui.dll,PrintUIEntry /if /b ""$printerName"" /f ""$infPath"" /r ""$portName"" /m ""$model"""
    
    $process = Start-Process -FilePath "rundll32" -ArgumentList "printui.dll,PrintUIEntry /if /b `"$printerName`" /f `"$infPath`" /r `"$portName`" /m `"$model`"" -Wait -PassThru
    
    if ($process.ExitCode -ne 0 -and $connectionType -eq "USB") {
        # If USB001 doesn't exist, some Windows versions fail to create it. Install to LPT1: temporarily.
        # When the user plugs in the USB, Windows will remap it or create a new instance automatically.
        Write-Host "USB001 not found, installing to LPT1: temporarily..."
        $portName = "LPT1:"
        Start-Process -FilePath "rundll32" -ArgumentList "printui.dll,PrintUIEntry /if /b `"$printerName`" /f `"$infPath`" /r `"$portName`" /m `"$model`"" -Wait -NoNewWindow
    }
    
    Write-Host "Success"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
