# port-evict

Force-stop local processes that own a TCP listener or UDP socket on a port.

```sh
npx port-evict 3000
```

Run `npm install -g port-evict` to make the command available as
`port-evict 3000`. The command accepts one decimal integer from 1 through 65535.
It exits with status 1 for invalid input or if it cannot stop a matching process.
If it finds no matching process, it exits successfully.

Requires Node.js 18 or later and has zero npm dependencies. Windows uses
`netstat.exe`, Linux uses `/proc`, and macOS uses the system `lsof` command.
Run with sufficient permissions to see and stop
the processes that own the port. Stopping a process also closes its other sockets.
