# scripts

## fix-vm-service-logon-right.ps1

Fixes a Hyper-V / WSL2 virtual machine that fails to start with:

```
HRESULT 0x80070569  (ERROR_LOGON_TYPE_NOT_GRANTED)
```

The Hyper-V worker process runs as the virtual account group
`NT VIRTUAL MACHINE\Virtual Machines` (SID `S-1-5-83-0`), which needs the
**Log on as a service** user right (`SeServiceLogonRight`). When Group Policy or
Local Security Policy denies that right, the VM cannot start.

The script:

1. Exports the current user-rights policy (and backs it up to your Desktop).
2. Removes `S-1-5-83-0` from **Deny log on as a service**
   (`SeDenyServiceLogonRight`) if present — deny overrides allow.
3. Adds `S-1-5-83-0` to **Log on as a service** (`SeServiceLogonRight`),
   preserving every other account that already holds the right.
4. Re-applies the policy with `secedit` and restarts the `vmms` service.

### Usage

Run from an **elevated** PowerShell window on the affected **Windows host**:

```powershell
powershell -ExecutionPolicy Bypass -File .\fix-vm-service-logon-right.ps1
```

### Domain-joined machines

If the user right is defined by a domain GPO, a local change is reverted on the
next policy refresh. Make the same change in the governing GPO instead:

```
Computer Configuration > Policies > Windows Settings > Security Settings
  > Local Policies > User Rights Assignment
```

### Verify

```powershell
secedit /export /areas USER_RIGHTS /cfg "$env:TEMP\ur.inf" | Out-Null
Select-String -Path "$env:TEMP\ur.inf" -Pattern 'SeServiceLogonRight','SeDenyServiceLogonRight'
```

`*S-1-5-83-0` should appear on the `SeServiceLogonRight` line and **not** on the
`SeDenyServiceLogonRight` line.
