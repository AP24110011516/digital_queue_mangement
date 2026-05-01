import { useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './authContextObject';
import { SOCKET_URL } from '../config';
import SocketContext from './socketContextObject';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user?.token) {
      return undefined;
    }

    const nextSocket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    nextSocket.on('connect', () => {
      setSocket(nextSocket);
      nextSocket.emit('register_session', {
        userId: user._id,
        role: user.role,
      });
    });

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
