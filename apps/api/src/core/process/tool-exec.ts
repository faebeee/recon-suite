/**
 * Security tooling the API may run through ToolExecService. This is a closed list: the
 * executor never accepts any other program name.
 */
export const EXEC_COMMANDS = ['nmap'] as const;
export type ExecCommand = (typeof EXEC_COMMANDS)[number];
