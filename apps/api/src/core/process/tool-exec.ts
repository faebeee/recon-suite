/**
 * Security tooling the API may run (nmap, gobuster) through ToolExecService. This is a closed list: the
 * executor never accepts any other program name.
 */
export const EXEC_COMMANDS = ['nmap', 'gobuster'] as const;
export type ExecCommand = (typeof EXEC_COMMANDS)[number];
