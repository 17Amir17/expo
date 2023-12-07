/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

#import <ABI50_0_0React/ABI50_0_0RCTDefines.h>

ABI50_0_0RCT_EXTERN NSString *const ABI50_0_0EXTRAPOLATE_TYPE_IDENTITY;
ABI50_0_0RCT_EXTERN NSString *const ABI50_0_0EXTRAPOLATE_TYPE_CLAMP;
ABI50_0_0RCT_EXTERN NSString *const ABI50_0_0EXTRAPOLATE_TYPE_EXTEND;

ABI50_0_0RCT_EXTERN NSUInteger ABI50_0_0RCTFindIndexOfNearestValue(CGFloat value, NSArray<NSNumber *> *range);

ABI50_0_0RCT_EXTERN CGFloat ABI50_0_0RCTInterpolateValue(
    CGFloat value,
    CGFloat inputMin,
    CGFloat inputMax,
    CGFloat outputMin,
    CGFloat outputMax,
    NSString *extrapolateLeft,
    NSString *extrapolateRight);

ABI50_0_0RCT_EXTERN CGFloat ABI50_0_0RCTInterpolateValueInRange(
    CGFloat value,
    NSArray<NSNumber *> *inputRange,
    NSArray<NSNumber *> *outputRange,
    NSString *extrapolateLeft,
    NSString *extrapolateRight);

ABI50_0_0RCT_EXTERN uint32_t
ABI50_0_0RCTInterpolateColorInRange(CGFloat value, NSArray<NSNumber *> *inputRange, NSArray<UIColor *> *outputRange);

// Represents a color as a int32_t. RGB components are assumed to be in [0-255] range and alpha in [0-1] range
ABI50_0_0RCT_EXTERN uint32_t ABI50_0_0RCTColorFromComponents(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha);

/**
 * Coefficient to slow down animations, respects the ios
 * simulator `Slow Animations (⌘T)` option.
 */
ABI50_0_0RCT_EXTERN CGFloat ABI50_0_0RCTAnimationDragCoefficient(void);
