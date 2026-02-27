import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';

import ConnectionScreen from './src/screens/ConnectionScreen';
import WebViewScreen from './src/screens/WebViewScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Connection">
          <Stack.Screen
            name="Connection"
            component={ConnectionScreen}
            options={{ title: 'Bağlantı Ayarları' }}
          />
          <Stack.Screen
            name="WebView"
            component={WebViewScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}
