import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  presenceList: any[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  presenceList: []
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode, user: any }> = ({ children, user }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceList, setPresenceList] = useState<any[]>([]);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (user) {
        newSocket.emit('join:presence', {
          userId: user.uid,
          name: user.displayName || 'Anonymous',
          handle: user.email?.split('@')[0] || 'anonymous',
          avatar: user.photoURL || '',
        });
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('presence:list', (list) => {
      setPresenceList(list);
    });

    return () => {
      newSocket.close();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, presenceList }}>
      {children}
    </SocketContext.Provider>
  );
};
