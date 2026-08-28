/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/
import {
    MessageSecurityMode,
    SecurityPolicy,
    UserIdentityInfo,
    UserIdentityInfoUserName,
    UserIdentityInfoX509,
    UserTokenType,
} from "node-opcua-client";
import { convertPEMtoDER } from "node-opcua-crypto";
import {
    OPCUACAuthenticationScheme,
    OPCUACUserNameAuthenticationScheme,
    OPCUACertificateAuthenticationScheme,
    OPCUAChannelSecurityScheme,
} from "./security-scheme";

export interface OPCUAChannelSecuritySettings {
    securityPolicy: SecurityPolicy;
    messageSecurityMode: MessageSecurityMode;
}

/**
 * Resolves the channel security settings from the given security scheme.
 * Will throw an error if the policy or message mode is invalid.
 * @param security The OPC UA channel security scheme.
 * @returns The resolved channel security settings.
 */
export function resolveChannelSecurity(security: OPCUAChannelSecurityScheme): OPCUAChannelSecuritySettings {
    if (security.scheme === "uav:channel-security" && security.messageMode !== "none") {
        const securityPolicy: SecurityPolicy = SecurityPolicy[security.policy as keyof typeof SecurityPolicy];

        if (securityPolicy === undefined) {
            throw new Error(`Invalid security policy '${security.policy}'`);
        }

        // Anything outside the modes we know is refused rather than quietly
        // turned into None, which would connect with less security than asked for.
        const messageMode: string = security.messageMode;
        let messageSecurityMode: MessageSecurityMode = MessageSecurityMode.Invalid;
        switch (messageMode) {
            case "sign":
                messageSecurityMode = MessageSecurityMode.Sign;
                break;
            case "sign_encrypt":
                messageSecurityMode = MessageSecurityMode.SignAndEncrypt;
                break;
            default:
                throw new Error(`Invalid message mode '${messageMode}'`);
        }

        return {
            securityPolicy,
            messageSecurityMode,
        };
    } else {
        return {
            securityPolicy: SecurityPolicy.None,
            messageSecurityMode: MessageSecurityMode.None,
        };
    }
}

/**
 * Resolves the user identity information from the given authentication scheme.
 * Will throw an error if the token type is invalid.
 * @param security The OPC UA authentication scheme.
 * @returns The resolved user identity information.
 */
export function resolvedUserIdentity(security: OPCUACAuthenticationScheme) {
    let userIdentity: UserIdentityInfo;
    const tokenType: string = security.tokenType;
    switch (tokenType) {
        case "username": {
            const userScheme = security as OPCUACUserNameAuthenticationScheme;
            userIdentity = <UserIdentityInfoUserName>{
                type: UserTokenType.UserName,
                password: userScheme.password,
                userName: userScheme.userName,
            };
            break;
        }
        case "certificate": {
            const certScheme = security as OPCUACertificateAuthenticationScheme;
            userIdentity = <UserIdentityInfoX509>{
                type: UserTokenType.Certificate,
                certificateData: convertPEMtoDER(certScheme.certificate),
                privateKey: certScheme.privateKey,
            };
            break;
        }
        case "anonymous":
            userIdentity = <UserIdentityInfo>{
                type: UserTokenType.Anonymous,
            };
            break;
        default:
            // Anonymous is the right default for an identity that was never
            // requested. It is the wrong answer for one we failed to recognise:
            // the author asked for an identity and would get none, silently.
            throw new Error(`Invalid user identity token type '${tokenType}'`);
    }

    return userIdentity;
}
