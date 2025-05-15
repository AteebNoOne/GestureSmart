interface VolumeModule {
    setVolume(volume: number): Promise<void>;
    getVolume(): Promise<number>;
    adjustVolume(delta: number): Promise<number>;
}

declare module 'react-native' {
    interface NativeModulesStatic {
        VolumeControl: VolumeModule;
    }
}