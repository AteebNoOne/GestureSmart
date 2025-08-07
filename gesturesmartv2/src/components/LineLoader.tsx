import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const LineLoader = () => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: false,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: false,
                }),
            ]).start(() => animate());
        };
        animate();
    }, []);

    const width = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['10%', '100%'],
    });

    return (
        <View style={styles.lineLoaderContainer}>
            <View style={styles.lineLoaderTrack}>
                <Animated.View style={[styles.lineLoaderFill, { width }]} />
            </View>
        </View>
    );
};

export default LineLoader;

const styles = StyleSheet.create({
    lineLoaderContainer: {
        marginTop: 20,
        width: 200,
        alignItems: 'center',
    },
    lineLoaderTrack: {
        width: '100%',
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        overflow: 'hidden',
    },
    lineLoaderFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
});