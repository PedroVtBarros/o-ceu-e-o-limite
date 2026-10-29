param(
  [Parameter(Mandatory = $true)][int]$OwnerProcessId,
  [Parameter(Mandatory = $true)][ValidateSet('Cancel', 'Choose', 'Confirm')][string]$Action,
  [string]$FilePath
)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class TestNativeWindows {
  public delegate bool Callback(IntPtr window, IntPtr arg);
  [DllImport("user32.dll")]public static extern bool EnumWindows(Callback callback,IntPtr arg);
  [DllImport("user32.dll")]public static extern bool EnumChildWindows(IntPtr parent,Callback callback,IntPtr arg);
  [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr window,out uint id);
  [DllImport("user32.dll")]public static extern int GetDlgCtrlID(IntPtr window);
  [DllImport("user32.dll")]public static extern IntPtr GetParent(IntPtr window);
  [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")]public static extern bool IsWindowEnabled(IntPtr window);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetClassName(IntPtr window,StringBuilder name,int length);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr window,StringBuilder name,int length);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr parameter,string text);
  [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr window,uint message,IntPtr parameter,IntPtr data);
  public static IntPtr FindDialog(int pid) {
    IntPtr result=IntPtr.Zero;
    EnumWindows((window,arg)=>{uint id;GetWindowThreadProcessId(window,out id);if(id==(uint)pid){var name=new StringBuilder(256);GetClassName(window,name,256);if(name.ToString()=="#32770"){result=window;return false;}}return true;},IntPtr.Zero);
    return result;
  }
  public static IntPtr Control(IntPtr parent,int id,string kind) {
    IntPtr result=IntPtr.Zero;
    EnumChildWindows(parent,(window,arg)=>{var name=new StringBuilder(256);GetClassName(window,name,256);if(GetDlgCtrlID(window)==id&&name.ToString()==kind){result=window;return false;}return true;},IntPtr.Zero);
    return result;
  }
  public static IntPtr ConfirmButton(IntPtr parent) {
    IntPtr result=IntPtr.Zero;
    EnumChildWindows(parent,(window,arg)=>{var kind=new StringBuilder(256);var name=new StringBuilder(256);GetClassName(window,kind,256);GetWindowText(window,name,256);if(kind.ToString()=="Button"&&name.ToString().Replace("&","")=="Restaurar e substituir"){result=window;return false;}return true;},IntPtr.Zero);
    return result;
  }
}
'@
$deadline = [DateTime]::UtcNow.AddSeconds(20)
$button = [IntPtr]::Zero
do {
  $handle = [TestNativeWindows]::FindDialog($OwnerProcessId)
  if ($handle -ne [IntPtr]::Zero) {
    $button = switch ($Action) {
      'Cancel' { [TestNativeWindows]::Control($handle, 2, 'Button') }
      'Choose' { [TestNativeWindows]::Control($handle, 1, 'Button') }
      'Confirm' { [TestNativeWindows]::ConfirmButton($handle) }
    }
    $editReady = $Action -ne 'Choose' -or [TestNativeWindows]::Control($handle, 1001, 'Edit') -ne [IntPtr]::Zero -or [TestNativeWindows]::Control($handle, 1148, 'Edit') -ne [IntPtr]::Zero
    if ($editReady -and $button -ne [IntPtr]::Zero -and [TestNativeWindows]::IsWindowVisible($button) -and [TestNativeWindows]::IsWindowEnabled($button)) { break }
  }
  Start-Sleep -Milliseconds 100
} while ([DateTime]::UtcNow -lt $deadline)
if ($button -eq [IntPtr]::Zero) { throw 'Native dialog button was not available.' }
if ($Action -eq 'Choose') {
  if (-not [System.IO.Path]::IsPathRooted($FilePath)) { throw 'Test file path must be absolute.' }
  $edit = [TestNativeWindows]::Control($handle, 1001, 'Edit')
  if ($edit -eq [IntPtr]::Zero) { $edit = [TestNativeWindows]::Control($handle, 1148, 'Edit') }
  if ($edit -eq [IntPtr]::Zero) { throw 'File name control was not available.' }
  [void][TestNativeWindows]::SendMessage($edit, 0x000C, [IntPtr]::Zero, $FilePath)
}
if (-not [TestNativeWindows]::PostMessage([TestNativeWindows]::GetParent($button), 0x0111, [IntPtr]([TestNativeWindows]::GetDlgCtrlID($button)), $button)) { throw 'Could not invoke native dialog button.' }
Write-Output "Native dialog: $Action completed."
